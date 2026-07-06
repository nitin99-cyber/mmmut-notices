# ROADMAP.md

# Nexsus Notice Intelligence Platform (NNIP)

> AI Powered Notice Intelligence, Processing & Distribution Platform

---

# Project Vision

Create a fully automated notice ecosystem that converts traditional university PDF notices into structured, searchable, multilingual, AI-powered digital content and distributes them across multiple platforms with minimal human intervention.

The final system should require **zero manual processing** after deployment, while still allowing administrators to review notices before publication.

---

# Current Status

## Phase Progress

| Phase | Status |
|---------|--------|
| Project Planning | ✅ Completed |
| Admin Portal | ✅ Completed |
| OCR Pipeline | ✅ Completed |
| Gemini AI Pipeline | ✅ Completed |
| Database Integration | ✅ Completed |
| Manual Publishing | 🟡 In Progress |
| Public Website | ❌ Not Started |
| Scraper | ❌ Not Started |
| Queue System | ❌ Not Started |
| Android App | ❌ Not Started |

Current Completion:

Approximately **55-60%**

---

# Phase 1 — Foundation (Completed)

## Goal

Build a working AI notice processor.

---

## Completed

- Next.js Admin Portal

- PDF Upload

- FastAPI OCR Service

- EasyOCR Integration

- OCR Confidence Calculation

- Character Count Detection

- Gemini Text Processing

- Translation

- Summary Generation

- Category Detection

- Audience Detection

- Database Integration

- Manual Review

---

# Phase 2 — Architecture Refactor (Current Priority)

## Goal

Transform the existing project into a production-ready service-oriented architecture.

---

## Objectives

Separate project into independent services.

Introduce processing jobs.

Introduce worker architecture.

Implement retry mechanism.

---

## Tasks

### Database

Create

processing_jobs

table

Status values:

- pending

- downloading

- ocr

- vision

- ai

- completed

- failed

---

### Backend Refactor

Move OCR into independent worker.

Move Gemini into independent worker.

Move publishing into distribution worker.

Remove direct OCR calls from frontend.

---

### Health Monitoring

OCR Health Endpoint

Gemini Health Endpoint

Worker Status

Queue Status

---

# Phase 3 — Notice Scraper

## Goal

Automatically discover newly published notices.

---

## Stack

Node.js

TypeScript

Cheerio

Axios

Cron Scheduler

---

## Workflow

Scheduler

↓

Fetch MMMUT Notice Page

↓

Extract Notice Links

↓

Extract PDF URL

↓

Duplicate Check

↓

Create Processing Job

---

## Features

Duplicate Detection

Retry Failed Downloads

Temporary File Storage

Logging

---

# Phase 4 — Processing Queue

## Goal

Prevent failures from affecting notice processing.

---

Workflow

Notice Found

↓

Job Created

↓

Queue

↓

Worker Picks Job

↓

Process

↓

Complete

---

Features

Retry Failed Jobs

Pause Queue

Resume Queue

Priority Queue

Dead Letter Queue (Future)

---

# Phase 5 — OCR Worker

## Goal

Extract text locally whenever possible.

---

Technology

Python

FastAPI

EasyOCR

PyMuPDF

---

Processing

PDF

↓

Image Conversion

↓

EasyOCR

↓

Confidence Calculation

↓

Return OCR Result

---

Decision

If OCR unavailable

↓

Gemini Vision

If OCR available

↓

Confidence Check

---

# Phase 6 — AI Processing

## Goal

Generate structured notice information.

---

Input

OCR Text

OR

Notice Images

---

Output

```json
{
"title":"",
"summary":"",
"translation":"",
"category":"",
"audience":[],
"important_dates":[],
"is_large_notice":false,
"page_count":1,
"whatsapp":"",
"telegram":"",
"calendar_events":[]
}
```

---

## Large Notice Detection

Purpose

Avoid processing hundreds of pages unnecessarily.

Examples

Hostel Allotment

Scholarship Lists

Student Lists

Result Lists

Attendance Lists

---

If

More than 3 pages

OR

Large student table detected

↓

Generate

Summary of first page

Important instructions

Original PDF link

Do NOT summarize every student.

---

# Phase 7 — Distribution Engine

Goal

Generate every distribution format automatically.

---

Website

Complete Notice

↓

Dynamic Page

---

WhatsApp

Short Summary

↓

Notice Link

---

Telegram

Medium Summary

↓

Notice Link

---

Calendar

Deadline

↓

Google Calendar Event

---

Future

Email

Discord

Mobile Push

---

# Phase 8 — Admin Portal

Goal

Review before publishing.

---

Workflow

Upload

↓

AI Processing

↓

Draft

↓

Review

↓

Publish

---

Features

Publish

Archive

Retry

Edit AI Output

Preview

View Logs

---

# Phase 9 — Public Website

Goal

Student-first experience.

---

Homepage

Latest Notices

Search

Upcoming Deadlines

Categories

---

Notice Feed

Search

Filter

Sort

Pagination

---

Notice Detail

Summary

Translation

Original Hindi

Original PDF

Important Dates

Add to Calendar

Share

---

Deadlines Page

Upcoming Deadlines

Past Deadlines

Calendar View

---

Search

Title

Summary

Category

Audience

Translation

Keywords

---

# Phase 10 — Android Application

Goal

Deliver notices directly to students.

---

Features

Latest Notices

Search

Categories

Bookmarks

Offline Reading

Push Notifications

Calendar Integration

Original PDF

---

Notifications

Backend

↓

Firebase Cloud Messaging

↓

Android Device

---

# Phase 11 — Web Scraping Automation

Goal

Completely eliminate manual uploads.

---

Scheduler

↓

MMMUT Website

↓

Detect New Notice

↓

Duplicate Check

↓

Download PDF

↓

Queue

↓

OCR

↓

AI

↓

Draft

↓

Publish

---

# Phase 12 — Analytics

Admin Dashboard

Total Notices

Processing Time

OCR Success Rate

Vision Fallback Rate

Most Viewed Notices

Popular Categories

Search Analytics

---

# Phase 13 — Future Features

AI Chatbot

Ask questions about notices.

---

Smart Recommendations

Recommend notices based on

Year

Branch

Audience

---

Deadline Reminder

Automatic reminders

1 day before

3 days before

1 week before

---

Academic Timeline

Generate semester timeline automatically.

---

Mobile Widgets

Upcoming Deadlines

Latest Notices

---

# Deployment Roadmap

Current

Local Development

↓

Next

Vercel

↓

Railway

↓

Supabase

↓

Firebase

---

# Folder Structure

```
apps/
    admin/
    website/
    android/

services/
    scraper/
    ocr/
    ai/
    distribution/
    scheduler/

workers/
    notice-worker/
    distribution-worker/

packages/
    shared/
    database/
    types/

docs/
```

---

# Milestones

## Milestone 1

Architecture Refactor

Estimated

2 Days

---

## Milestone 2

Scraper

Estimated

2 Days

---

## Milestone 3

Queue System

Estimated

2 Days

---

## Milestone 4

Distribution Engine

Estimated

3 Days

---

## Milestone 5

Public Website API

Estimated

2 Days

---

## Milestone 6

Website

Estimated

4 Days

---

## Milestone 7

Android App

Estimated

5 Days

---

## Milestone 8

Automation

Estimated

3 Days

---

# Success Criteria

The project is considered production-ready when:

- New notices are detected automatically.

- Duplicate notices are ignored.

- OCR and AI processing happen without manual intervention.

- AI generates structured notice data.

- Administrator reviews and publishes with one click.

- Students receive notifications automatically.

- Website updates instantly.

- Calendar events are generated automatically.

- WhatsApp messages are generated automatically.

- Telegram messages are generated automatically.

- Processing failures can be retried without data loss.

---

# Long-Term Vision

Build a reusable **University Notice Intelligence Platform** that can be deployed for any educational institution.

The system should eventually support multiple universities through a configurable architecture, making it a generic AI-powered notice management platform rather than a solution limited to MMMUT.