# Scraper Service Documentation

# Nexsus Notice Intelligence Platform

Version: 2.0

---

# Purpose

The Scraper Service is responsible for automatically monitoring the MMMUT Notice Portal and detecting newly published notices.

It acts as the entry point of the entire Notice Intelligence Pipeline.

The scraper **does not perform OCR, AI processing, translation, or publication.** Its sole responsibility is to discover new notices and create processing jobs.

This separation makes the architecture modular, scalable, and fault tolerant.

---

# Responsibilities

The scraper is responsible for:

- Periodically checking the official MMMUT notice page.
- Extracting all available notice metadata.
- Identifying newly published notices.
- Preventing duplicate processing.
- Creating processing jobs.
- Logging scraper activity.

The scraper is NOT responsible for:

- OCR
- Translation
- Gemini
- Database formatting
- Website publishing
- WhatsApp generation

---

# Architecture

```
Scheduler
      │
      ▼
Scraper Service
      │
      ▼
Extract Notice Metadata
      │
      ▼
Duplicate Detection
      │
      ▼
Create Processing Job
      │
      ▼
Queue
```

---

# Source Website

Current Source

```
https://www.mmmut.ac.in/AllRecord
```

Every notice contains

- Notice title
- Publish date
- PDF link

Example PDF

```
https://www.mmmut.ac.in/News_content/52244notice_06082026.pdf
```

The scraper must never hardcode notice URLs.

---

# Scheduler

The scraper should not run continuously.

Recommended interval

```
Every 30 minutes
```

Future

```
Every 15 minutes
```

Scheduler Options

- GitHub Actions
- Railway Cron
- Node Cron
- Cloud Scheduler

---

# Scraper Workflow

```
Start

↓

Fetch Notice Page

↓

Parse HTML

↓

Extract Notice Metadata

↓

Compare With Database

↓

New Notice?

↓

NO

↓

Stop

↓

YES

↓

Create Processing Job

↓

Finish
```

---

# Metadata Extraction

Each notice should contain

```
Notice Title

Publish Date

PDF URL

Source URL

Scraped Time
```

Example

```json
{
  "title": "Important Notice regarding Registration",
  "date": "2026-06-08",
  "pdf_url": "https://....pdf",
  "source": "https://www.mmmut.ac.in/AllRecord"
}
```

---

# Duplicate Detection

Before creating a processing job, verify whether the notice already exists.

Priority

## Level 1

Compare PDF URL

```
Exists?

↓

Yes

↓

Ignore
```

---

## Level 2

Compare SHA256 hash

Useful if the same notice is uploaded with a different URL.

---

## Level 3

Compare title + publish date

Final fallback.

---

# Duplicate Strategy

```
PDF URL Exists

↓

Skip
```

If URL changed

```
Calculate SHA256

↓

Hash Exists

↓

Skip
```

Otherwise

```
New Notice

↓

Create Job
```

---

# Download Strategy

The scraper downloads PDFs only after duplicate detection.

Downloaded files are temporary.

```
Download

↓

Processing

↓

Delete
```

No permanent storage.

---

# Temporary Storage

Folder

```
/temp
```

Example

```
temp/

notice_001.pdf

notice_002.pdf
```

Files should always be deleted after processing.

---

# Processing Job Creation

The scraper creates a new job instead of directly invoking OCR.

Example

```json
{
    "notice_url": "...",
    "status": "pending",
    "source": "scraper"
}
```

OCR workers consume pending jobs independently.

---

# Processing Queue

Status

```
pending

↓

downloading

↓

ocr

↓

ai_processing

↓

review

↓

published
```

Failure

```
failed
```

---

# Error Handling

Possible failures

Website unavailable

↓

Retry later

---

HTML structure changed

↓

Log error

↓

Notify administrator

---

PDF unavailable

↓

Mark failed

↓

Retry

---

Download interrupted

↓

Retry

---

Duplicate

↓

Skip

---

# Retry Policy

Retry Count

```
3
```

Retry Interval

```
10 minutes
```

After maximum retries

```
Move to Failed Queue
```

---

# Logging

Every scraper execution should log

```
Timestamp

Execution Time

Total Notices

New Notices

Duplicates

Failures

Duration
```

Example

```
2026-07-08 10:30

Total Notices : 421

New : 2

Duplicates : 419

Failed : 0

Execution : 3.4 sec
```

---

# Database Tables

## scraped_notices

```
id

title

pdf_url

publish_date

hash

status

created_at
```

---

## processing_jobs

```
id

notice_id

current_stage

status

retry_count

error_message

created_at

completed_at
```

---

# Technologies

Language

```
TypeScript
```

Runtime

```
Node.js
```

Libraries

```
Axios

Cheerio

Node Cron

Crypto

Supabase SDK
```

---

# Folder Structure

```
scraper/

├── index.ts

├── scheduler.ts

├── fetcher.ts

├── parser.ts

├── duplicate.ts

├── downloader.ts

├── hash.ts

├── queue.ts

├── logger.ts

└── config.ts
```

---

# Module Responsibilities

## scheduler.ts

Runs every 30 minutes.

---

## fetcher.ts

Downloads HTML.

---

## parser.ts

Extracts notice metadata.

---

## duplicate.ts

Checks existing notices.

---

## downloader.ts

Downloads PDFs.

---

## hash.ts

Generates SHA256 hash.

---

## queue.ts

Creates processing jobs.

---

## logger.ts

Stores execution logs.

---

# Health Check

Endpoint

```
GET /health/scraper
```

Example Response

```json
{
    "status":"healthy",
    "last_run":"2026-07-08T10:30",
    "last_notice":"2026-07-08T09:15"
}
```

---

# API

Run scraper manually

```
POST /api/scraper/run
```

Response

```json
{
    "new_notices":2,
    "duplicates":14,
    "jobs_created":2
}
```

---

# Future Improvements

Support multiple universities

```
MMMUT

AKTU

IET

MNNIT

IIIT Lucknow
```

Every university will implement its own parser while using the same processing pipeline.

---

# Design Principles

The scraper should:

✔ Never process notices.

✔ Never call Gemini.

✔ Never perform OCR.

✔ Never publish.

✔ Never modify notices.

Its only responsibility is to discover notices and create processing jobs.

Keeping the scraper independent makes the system scalable, maintainable, and easy to debug.

---

# Future Architecture

```
Scheduler

↓

Scraper

↓

Duplicate Detection

↓

Job Queue

↓

OCR Worker

↓

AI Worker

↓

Distribution Worker

↓

Website

↓

WhatsApp

↓

Telegram

↓

Calendar
```

The scraper remains the first component of the Notice Intelligence Pipeline and serves as the single automated entry point for all future notice processing.