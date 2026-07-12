# Architecture & System Decisions

This document tracks significant technical and architectural decisions made for the MMMUT Notice Intelligence Platform, including why they were made and alternatives considered.

## 1. Zero-Cost Hosting & Service Separation
**Decision:** Split the monolithic application into three distinct services: Next.js (Admin/Pipeline), Node.js (Scraper), and FastAPI (EasyOCR).
**Why:** MMMUT requires a zero-cost solution. Vercel is great for Next.js but restricts cron job times and heavily penalizes long-running OCR tasks. Railway offers a $5 credit suitable for Python OCR, and GitHub Actions gives 2000 free minutes for cron jobs.
**Alternatives:** 
- A single VPS (e.g., DigitalOcean Droplet for $5/mo). *Rejected: incurs monthly costs.*
- Everything on Railway. *Rejected: credit would exhaust quickly if scraper and Next.js ran 24/7.*

## 2. Gemini as Primary AI, Groq as Fallback
**Decision:** Use Google's `gemini-2.5-flash` as the primary extraction model with `llama-3.3-70b-versatile` (via Groq) as the fallback.
**Why:** Gemini 2.5 Flash has native multimodal (vision) capabilities, allowing us to send PDFs directly when EasyOCR fails. Its free tier is generous (15 RPM). Groq is extremely fast but its vision models (Llama 3.2 11B) are smaller and less reliable for complex Hindi OCR, making it a better fallback than primary.
**Alternatives:** 
- OpenAI GPT-4o-mini. *Rejected: not free.*
- Claude 3 Haiku. *Rejected: no permanent free tier.*

## 3. PDF Slicing for Vision Models
**Decision:** Extract only the first page of multi-page PDFs using `pdf-lib` before sending them to Gemini Vision.
**Why:** Gemini charges per page for PDF processing. Large documents (e.g., 50-page hostel allotment lists) would quickly exhaust the free tier tokens. Since the core context (Title, Date, Category) is always on the first page, slicing prevents token waste.
**Alternatives:**
- Process all pages. *Rejected: rapidly exhausts Gemini's free tier.*
- Convert PDF to images in Python first. *Rejected: moves heavy processing to Next.js API route or adds latency to the OCR service.*

## 4. WhatsApp-First Distribution
**Decision:** Distribute notices directly to students via a WhatsApp Channel instead of a public website.
**Why:** Students already check WhatsApp constantly. A public website requires SEO, mobile optimization, and hosting resources, whereas a WhatsApp message with Google Calendar links achieves better engagement instantly.
**Alternatives:**
- A public Next.js dashboard for students. *Rejected: requires active user habit changes.*
- Email newsletters. *Rejected: lower open rates among students compared to WhatsApp.*

## 5. Scraper Content Filtering
**Decision:** Silently ignore notices with titles containing "Office Order", "Professor", "Faculty", or "Staff" during the scraping phase.
**Why:** These notices are irrelevant to the student body. Passing them through the AI pipeline wastes OCR processing time, AI tokens, and clutters the Admin dashboard. Filtering at the scraper level (using Cheerio) is extremely fast and cost-free.
**Alternatives:**
- Let AI categorize and flag them as "Faculty". *Rejected: wastes AI tokens.*
- Admin manually deletes them. *Rejected: increases admin workload.*

## 6. Unconditional Email Delivery with WhatsApp CTA
**Decision:** Admin notification emails (containing the AI-processed notice and a direct "Share to WhatsApp" CTA) are sent unconditionally, even if the Supabase database insert fails.
**Why:** Environment variable misconfigurations (like missing or incorrect Supabase credentials) can easily cause the database save to fail. By uncoupling the email delivery from the database save, the admin never loses the generated AI output and can still publish the notice seamlessly using the CTA link, improving fault tolerance.
**Alternatives:**
- Only send email if DB save succeeds. *Rejected: could cause silent data loss of the processed AI output if Supabase goes down or is misconfigured.*

## 7. Environment-Aware Python Execution for Localhost
**Decision:** The Next.js `package.json` uses a relative path to the Python virtual environment (`.\venv\Scripts\python`) to launch the local EasyOCR service via `uvicorn`.
**Why:** Windows often struggles with global PATH configurations for Python packages. By explicitly invoking the virtual environment's Python executable from `package.json`, developers can run the entire monolithic dev stack (`npm run dev`) immediately after installing dependencies without manual shell activation or PATH troubleshooting.
**Alternatives:**
- Relying on global `uvicorn` command. *Rejected: frequently causes "not recognized as internal or external command" errors on Windows.*

## 8. Node.js 22 for Scraper Actions
**Decision:** Configure GitHub Actions to use Node.js 22 for running the automated scraper.
**Why:** Supabase JavaScript Client v2 relies on native WebSockets for Realtime features. Native WebSockets were introduced officially in Node.js 22. Running the scraper on Node 20 resulted in "Node.js detected but native WebSocket not found" errors, crashing the automation.
**Alternatives:**
- Provide a custom WebSocket polyfill in Node 20. *Rejected: adds unnecessary dependencies and maintenance overhead when simply upgrading the action's Node version cleanly solves the issue.*

## 9. Strict Scraper DOM Targeting
**Decision:** Restrict Cheerio to parse only specific HTML containers (`#ContentPlaceHolder2_GridView1` and `<marquee>`) rather than scraping all `a[href$=".pdf"]` links on the page.
**Why:** The generic approach scraped static site navigation links (Privacy Policy, Placement Brochure, etc.) that happened to be PDFs, triggering false-positive AI processing jobs. Tightening the DOM selector perfectly filters out these static files.
**Alternatives:** 
- Exclude specific keywords (e.g. "Privacy Policy"). *Rejected: hard to maintain a growing blocklist.*

## 10. Fallback Vision Pipeline Architecture
**Decision:** Reject Groq Vision fallback if EasyOCR is down and Gemini Vision fails, rather than implementing a Node.js PDF-to-Image pipeline in Next.js.
**Why:** Groq Vision exclusively requires images (base64) and rejects PDFs. We attempted to use `pdfjs-dist` and `canvas` in Next.js to convert the PDF to an image for Groq. However, `canvas` is a native C++ module that fails to compile in Vercel's serverless environment. Rather than introduce complex WebAssembly workarounds (`pdf2pic`/Ghostscript), we accept that a simultaneous failure of both EasyOCR and Gemini Vision is an acceptable edge case to throw an error on.
**Alternatives:**
- Compile `canvas` with Vercel build flags. *Rejected: brittle and prone to breaking on Vercel updates.*
- Use a third-party PDF-to-Image API. *Rejected: violates zero-cost requirement.*

## 11. Serverless Email Execution on Vercel
**Decision:** `await` the background email notification promise before returning the API response.
**Why:** Vercel uses Serverless Functions which terminate immediately after the HTTP response is sent. A "fire-and-forget" background promise for sending emails via `nodemailer` works locally but is abruptly killed in Vercel before the email can dispatch. Awaiting it guarantees delivery and allows us to return the success/failure status in the JSON response.
**Alternatives:**
- Use a background job queue (e.g. Inngest, Upstash QStash). *Rejected: introduces unnecessary complexity and potential cost for a simple admin notification.*

## 12. TinyURL for Google Calendar Links
**Decision:** Use the free TinyURL API (`tinyurl.com/api-create.php`) on the Next.js server to compress Google Calendar links before injecting them into the WhatsApp message.
**Why:** WhatsApp does not support markdown link masking (e.g. `[text](url)`), so raw URLs are displayed. Google Calendar event template URLs are exceptionally long and make the WhatsApp message unreadable. TinyURL provides a free, keyless API that solves this perfectly without violating the zero-cost requirement.
**Alternatives:**
- Bitly or Rebrandly. *Rejected: requires API keys, rate limits, and setup overhead.*
- Leave as long URLs. *Rejected: severely degrades WhatsApp user experience.*

## 13. AI Date Range Parsing
**Decision:** Instruct the AI schema to extract `end_date` alongside `start_date` (mapped from `date`), and combine date ranges (e.g. "July 11 to July 20") into a single Google Calendar event.
**Why:** The AI was previously generating separate calendar events for the start and end dates of a single process (like fee submission). Consolidating them natively in the AI schema allows `calendar.ts` to output a single, clean multi-day calendar event link.
## 14. Scraper 404 "Dead Link" Caching
**Decision:** If a PDF download fails with an HTTP 404 error during the scraper run, immediately log the notice to the database with `status: 'dead_link'` and a dummy hash, instead of just failing.
**Why:** The university often leaves HTML links on the `AllRecord` page for PDFs they have already deleted from their server. Previously, the scraper would fail to download them, drop them from the current run, and then indefinitely retry downloading them every 30 minutes, spamming the logs. Caching them as dead links allows the URL duplicate-checker to instantly ignore them on all future runs.

## 15. Real-Time Scraper AI Pipeline Automation
**Decision:** Have the Node.js scraper proactively trigger the Vercel AI pipeline (`/api/ocr` and `/api/ai`) using native `fetch` and `FormData` immediately after finding a new working PDF.
**Why:** The previous architecture required the admin to manually click "Process" on the dashboard for every new job in `processing_jobs`. By making the scraper act as a client that POSTs the PDF directly to the production endpoints, the system becomes 100% autonomous. The admin now simply receives a success (or failure) email without ever having to log in to process notices manually.

## 16. Proactive AI Failure Notifications
**Decision:** Update `/api/ai` to dispatch an explicit "Failure Email" to the admin if the Gemini AI generation crashes or times out.
**Why:** With the pipeline now fully automated by the scraper, the admin is completely hands-off. If the AI fails (e.g., rate limits, bad PDF format), the notice would silently get stuck in a pending state. A proactive failure email ensures the admin is alerted to manually intervene via the dashboard only when absolutely necessary.

## 17. Strict Apple-Style Design System Implementation
**Decision:** Implement the frontend completely using vanilla CSS custom properties matching the Apple design language (SF Pro/Inter, pill buttons, #f5f5f7 canvas, specific blue tokens) instead of relying on generic Tailwind utility classes.
**Why:** The `DESIGN.md` specification requires a highly specific, restrained aesthetic (e.g., 980px border radii, hairline borders instead of shadows, specific typography tracking). Enforcing this via central CSS variables in `globals.css` ensures strict adherence across all pages and prevents "utility class drift" where developers might accidentally introduce non-compliant spacing or shadows.

## 18. JSONB Pipeline Audit Trail
**Decision:** Store the complete, multi-stage AI pipeline processing log as a single `pipeline_log` JSONB column on the `notices` table.
**Why:** Tracking a notice through Upload → OCR → Decision → AI Model → Database requires a flexible schema, as different branches (Text Path vs. Vision Path) produce different metadata (OCR confidence vs. Vision reasoning). A JSONB column avoids creating a complex set of normalized tables for logs that are strictly read-only after creation. It provides full transparency in the Admin and History UI without complex SQL joins.

## 19. Graceful Database Degradation
**Decision:** Design the new `/api/notices` GET route to gracefully handle missing columns (`sent`, `pipeline_log`) and tables.
**Why:** During active development and deployment rollouts, the frontend code might deploy slightly before the Supabase SQL migrations are run. If the API strictly expected the new columns, the entire dashboard would crash. By detecting missing columns and normalizing the data (e.g., returning `null` for `pipeline_log`), the UI remains functional for legacy notices while waiting for the migration.

## 20. Separation of Landing Page and Admin Dashboard
**Decision:** Keep the root `/` route as a clean, simple marketing landing page strictly adhering to `DESIGN.md`, while building a separate `/dashboard` route for data-dense admin statistics, limits, and the activity feed.
**Why:** Attempting to force a complex GitHub-style activity feed and API usage charts onto the public-facing Home page violated the minimalist Apple-style aesthetic requested in the design specs. Separating concerns ensures the public facing site remains clean while giving admins the screen real estate necessary for complex data tables and timelines.

## 21. Automated Pipeline Log Injection
**Decision:** Inject the `pipeline_log` JSON object natively at the end of the automated `/api/ai` processing route before saving to Supabase.
**Why:** Previously, the `pipeline_log` track record was only generated by the React frontend when an admin manually clicked "Process". As a result, the fully automated Node.js scraper was saving notices *without* a track record, rendering the History page blank for automated runs. By moving the log construction to the backend API, we guarantee that 100% of processed notices (manual or automated) leave an immutable audit trail of the AI models and OCR methods used.
