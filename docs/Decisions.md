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
