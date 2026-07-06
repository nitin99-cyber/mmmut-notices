# DEPLOYMENT.md

#  Notice Intelligence Platform
## Deployment Architecture & Production Guide

Version: 2.0

---

# Deployment Philosophy

The Nexsus Notice Intelligence Platform is designed using a **microservice-inspired architecture**, where every component has a single responsibility.

Instead of deploying one monolithic application, the platform consists of independent services communicating through APIs and the database.

This architecture improves:

- Reliability
- Scalability
- Maintainability
- Fault tolerance
- Easier debugging

---

# Production Architecture

```
                        Internet
                            │
                            ▼
                  MMMUT Notice Website
                            │
                            ▼
                  Scheduler (Cron Job)
                            │
                            ▼
                   Scraper Service
                            │
                    Duplicate Checker
                            │
                            ▼
                  Processing Job Queue
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
    OCR Worker                         Gemini Worker
          │                                   │
          └─────────────────┬─────────────────┘
                            ▼
                   Notice Intelligence Engine
                            │
                            ▼
                      Supabase Database
                            │
      ┌───────────────┬───────────────┬───────────────┐
      ▼               ▼               ▼               ▼
 Website API     Android App     Admin Panel     Distribution
                                                    │
                                        ┌───────────┼────────────┐
                                        ▼           ▼            ▼
                                    WhatsApp    Telegram    Calendar
```

---

# Services Overview

| Service | Responsibility | Deployment |
|----------|---------------|------------|
| Admin Portal | Upload & Review | Vercel |
| Website | Student Portal | Vercel |
| Scraper | Fetch Notices | Railway |
| OCR Worker | OCR Processing | Railway |
| Gemini Worker | AI Processing | Railway |
| Scheduler | Cron Jobs | Railway |
| Database | Notice Storage | Supabase |
| File Storage | PDFs | Supabase Storage |

---

# Deployment Strategy

The platform is deployed in independent services.

Each service can be restarted or upgraded without affecting the others.

---

# 1. Frontend Deployment

Platform

```
Vercel
```

Contains

```
Admin Portal

Student Website

REST APIs

Authentication

Search API
```

Deployment Command

```bash
vercel --prod
```

Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

GOOGLE_GEMINI_API_KEY

INTERNAL_API_SECRET
```

---

# 2. Database

Platform

```
Supabase
```

Contains

```
Notices

Processing Jobs

Logs

Categories

Audience

Important Dates
```

Backups

Automatic

Daily

---

# 3. OCR Worker

Platform

```
Railway
```

Reason

EasyOCR requires

- Python
- Torch
- CPU
- RAM

Hosting OCR separately prevents frontend downtime.

Responsibilities

```
PDF

↓

Image Conversion

↓

OCR

↓

Confidence Score

↓

Return JSON
```

Health Endpoint

```
GET

/health
```

Returns

```json
{
  "status":"healthy"
}
```

---

# 4. Gemini Worker

Platform

```
Railway
```

Responsibilities

Receives

```
OCR Text

or

PDF Images
```

Returns

```
Translation

Summary

Category

Audience

Dates

WhatsApp

Telegram
```

---

# 5. Scheduler

Runs every

```
30 minutes
```

Responsibilities

```
Check MMMUT

↓

Detect New Notice

↓

Create Processing Job
```

Never performs OCR.

Never performs AI.

---

# 6. Scraper Service

Responsibilities

```
Download Notice List

↓

Extract PDF URLs

↓

Duplicate Detection

↓

Create Job
```

No OCR.

No AI.

---

# 7. Job Queue

Every new notice creates one job.

Job Lifecycle

```
Pending

↓

Downloading

↓

OCR

↓

AI

↓

Draft

↓

Published

↓

Completed
```

Failed jobs

↓

Retry

---

# OCR Availability

OCR Worker may become unavailable.

Instead of failing

System checks

```
OCR Healthy?
```

YES

↓

EasyOCR

NO

↓

Gemini Vision

No notice is lost.

---

# Duplicate Detection

Primary

```
PDF URL
```

Secondary

```
SHA256 Hash
```

Workflow

```
URL Exists?

↓

YES

↓

Ignore

↓

NO

↓

Download PDF
```

---

# Temporary File Management

Every PDF

↓

Downloads

↓

Processes

↓

Deletes

Files are never permanently stored locally.

---

# Large Notice Detection

Large notices include

- Hostel Allotment
- Examination Lists
- Scholarship Lists
- Roll Number Lists

Detection

```
Pages > 3

OR

Large Table

OR

Mostly Names
```

If true

AI only summarizes

First Page

Website displays

```
Summary

↓

Download Original PDF
```

instead of processing hundreds of names.

---

# Processing Flow

```
Scheduler

↓

Scraper

↓

Duplicate Check

↓

Job Queue

↓

OCR Worker

↓

Confidence Evaluation

↓

Gemini Worker

↓

Structured JSON

↓

Database

↓

Admin Review

↓

Publish

↓

Website

↓

WhatsApp

↓

Telegram

↓

Calendar
```

---

# OCR Decision Engine

```
OCR Available?

↓

No

↓

Gemini Vision

↓

Done
```

Else

```
Confidence >= 50

AND

Characters >= 1000

↓

Gemini Text

Else

↓

Gemini Vision
```

---

# AI Output

Gemini returns

```json
{
"title":"",
"summary":"",
"translation":"",
"category":"",
"audience":[],
"important_dates":[],
"page_count":1,
"is_large_notice":false,
"whatsapp":"",
"telegram":""
}
```

---

# Admin Review

Every processed notice becomes

```
Draft
```

Admin reviews

↓

Approve

↓

Publish

Never auto-publish initially.

---

# Website Publishing

Publishing changes

```
status

draft

↓

published
```

Website automatically fetches

```
published
```

records.

No manual page creation.

---

# Dynamic Routing

Website

```
/notices

/notices/[slug]

/deadlines

/category/[category]

/search
```

Every page generated dynamically.

---

# Distribution

Publishing automatically creates

Website Page

WhatsApp Message

Telegram Message

Calendar Events

Share Link

Future

Email

Mobile Push

---

# Monitoring

Every service exposes

```
/health
```

Examples

```
OCR

Gemini

Scraper

Scheduler
```

Health Dashboard

```
Healthy

↓

Processing

↓

Offline

↓

Retrying
```

---

# Logging

Every job stores

```
Started

Completed

Duration

Errors

Retries

Worker Used
```

No processing happens without logs.

---

# Retry Strategy

Failure

↓

Retry after

5 min

↓

15 min

↓

30 min

↓

Mark Failed

Admin can manually retry.

---

# Security

Secrets never stored

Frontend

API Keys remain

Backend only.

All internal APIs protected using

```
Bearer Token
```

---

# Scaling Strategy

Initial

```
1 OCR Worker

1 Gemini Worker
```

Future

```
3 OCR Workers

2 Gemini Workers

Multiple Scrapers
```

No code changes required.

---

# Deployment Order

Phase 1

Deploy

```
Supabase
```

↓

Deploy

```
Admin Panel
```

↓

Deploy

```
Website
```

↓

Deploy

```
OCR Worker
```

↓

Deploy

```
Gemini Worker
```

↓

Deploy

```
Scheduler
```

↓

Deploy

```
Scraper
```

↓

Production Ready

---

# Production Checklist

Frontend

- [ ] Vercel deployed

Backend

- [ ] Railway deployed

Database

- [ ] Supabase configured

Storage

- [ ] Supabase Storage enabled

OCR

- [ ] Health endpoint working

Gemini

- [ ] API connected

Scheduler

- [ ] Running every 30 min

Scraper

- [ ] Duplicate detection enabled

Website

- [ ] Dynamic routes working

Distribution

- [ ] WhatsApp generation working

Admin

- [ ] Publish workflow completed

Monitoring

- [ ] Logs enabled

Security

- [ ] Environment variables configured

---

# Future Infrastructure

Current

```
Manual Publish
```

↓

Auto Scraper

↓

AI Processing

↓

Admin Review

↓

Publish

↓

Students

Future

```
Auto Scraper

↓

AI Processing

↓

Quality Check

↓

Auto Publish

↓

Push Notifications

↓

Android App

↓

Telegram Bot

↓

Email Digest
```

---

# Final Goal

The complete deployment should operate without manual intervention.

Once deployed:

- The scheduler automatically checks for new notices.
- The scraper detects and downloads only new PDFs.
- OCR and AI process notices intelligently.
- The admin only reviews and publishes.
- Students receive structured notices through the website, messaging channels, and future mobile applications.

The platform becomes a fully automated Notice Intelligence & Distribution System capable of scaling to multiple institutions with minimal architectural changes.