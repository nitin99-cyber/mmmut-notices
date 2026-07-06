# MMMUT Notice Intelligence Platform

## 1. Overview
The MMMUT Notice Intelligence Platform is a robust system designed to digitize, index, and distribute college notices intelligently. Using state-of-the-art Optical Character Recognition (OCR) backed by AI, it automatically discovers notices from the university website, extracts text, categorizes them, and prepares them for distribution via WhatsApp.

## 2. Features
- **Automated Web Scraper**: Discovers new notices from the university website automatically.
- **Smart Duplicate Detection**: Avoids processing the same notice twice (URL + SHA256 checking).
- **Intelligent OCR Pipeline**: Extracts text using EasyOCR (on Railway) with fallback to Gemini Vision.
- **AI-Powered Summarization & Translation**: Leverages Google Gemini AI (with Groq fallback) to summarize lengthy notices and translate them to English.
- **Large Notice Handling**: Intelligently processes only the first page for large student lists, providing a link to the full PDF.
- **Calendar Integration**: Automatically extracts deadlines and generates Google Calendar add-to-calendar links.
- **WhatsApp Distribution**: Formats notices perfectly for WhatsApp channel broadcasting.
- **Zero-Cost Architecture**: Runs entirely on free tiers (GitHub Actions, Railway, Vercel, Supabase).

## 3. Architecture
The application is split into several independent, zero-cost components:
1. **Web Scraper (GitHub Actions)**: A TypeScript cron job that checks for new notices every 30 minutes.
2. **OCR Service (Railway)**: A FastAPI service running EasyOCR for text extraction.
3. **Database (Supabase)**: Stores raw, processing, and finalized notice data.
4. **Admin Panel & API (Vercel)**: A Next.js application for administrators to manage, process, and publish notices.
5. **AI Processing Engine**: Utilizes Gemini 2.5 Flash and Groq (Llama) for text and vision processing.

## 4. Folder Structure
```text
mmmut/
├── .env.example             # Environment variable template
├── README.md                # Project documentation (this file)
├── admin/                   # Next.js Admin Panel & API (formerly mmmut/)
├── easy_ocr/                # Python OCR Microservice
├── scraper/                 # TypeScript Web Scraper (runs on GitHub Actions)
├── docs/                    # Detailed architecture and API documentation
└── .github/workflows/       # GitHub Actions cron jobs
```

## 5. Prerequisites
- **Git**: For version control.
- **Node.js** (v20 or higher): Required for the Admin Panel and Scraper.
- **Python** (v3.11 or higher): Required for the OCR service.
- **Docker** (optional): For running the OCR service locally.

## 6. Setup Instructions

### Environment Variables
1. Copy `.env.example` to `.env` in the root and in the `admin` directory.
2. Fill in the required API keys (Supabase, Gemini, Groq).

### Supabase Setup
Create a Supabase project and set up the following tables:
- `notices`: For processed and published notices.
- `scraped_notices`: For raw scraped metadata.
- `processing_jobs`: For tracking pipeline progress.
- `system_logs`: For service logging.
*See `docs/Database.md` for schema details.*

### Admin Panel
```bash
cd admin
npm install
npm run dev
```

### OCR Service
```bash
cd easy_ocr
python -m venv venv
# Windows: venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Note: To deploy on Railway, use the provided Dockerfile.*

### Web Scraper
```bash
cd scraper
npm install
npm run scrape:dry # Test run without DB writes
npm run scrape     # Full run
```

## 7. Documentation
For detailed information on each component, refer to the `docs/` directory:
- [Architecture](docs/architecture.md)
- [AI Pipeline](docs/AI-Pipeline.md)
- [API](docs/API.md)
- [Scraper](docs/Scrapper.md)
- [Database](docs/Database.md)
- [Distribution](docs/Distribution.md)
- [Deployment](docs/Deployment.md)

## 8. Deployment
- **Admin Panel**: Deploy to Vercel (connect GitHub repository).
- **OCR Service**: Deploy to Railway using the `Dockerfile`.
- **Scraper**: Runs automatically via GitHub Actions (`.github/workflows/scrape.yml`).
