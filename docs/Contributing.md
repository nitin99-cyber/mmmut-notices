# Contributing Guide

Welcome to the ** Notice Intelligence Platform (NNIP)**.

Thank you for your interest in contributing! This project aims to automate the complete lifecycle of university notices—from discovery to AI processing and multi-platform distribution.

This document explains the project architecture, development workflow, coding standards, branching strategy, and contribution process.

---

# Project Philosophy

The project follows a **service-oriented architecture**.

Each component has a single responsibility.

Instead of creating one large application, the project is divided into independent services.

```
                Scheduler
                    │
                    ▼
             Scraper Service
                    │
                    ▼
           Processing Job Queue
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   OCR Worker             Gemini Worker
        │                       │
        └───────────┬───────────┘
                    ▼
           Structured Notice JSON
                    │
                    ▼
            Distribution Service
```

Every service should remain independent.

---

# Repository Structure

```
notice-platform/

docs/

frontend/

backend/

workers/

scraper/

ocr/

gemini/

distribution/

shared/

database/

scripts/
```

Each directory contains a single responsibility.

---

# Core Principles

## 1. Single Responsibility

Every service should perform exactly one task.

Example:

Scraper

✔ Detect notices

❌ OCR

❌ Gemini

❌ Database formatting

---

OCR Worker

✔ OCR

❌ AI Translation

---

Gemini Worker

✔ AI Processing

❌ Download PDFs

---

Distribution Worker

✔ Publish outputs

❌ OCR

---

## 2. Never Skip Validation

Every stage should validate its input.

Example:

```
Scraper

↓

Duplicate Detection

↓

Download

↓

OCR

↓

AI

↓

Publish
```

Never assume previous stages succeeded.

---

## 3. Fail Gracefully

Failures should never stop the pipeline.

Instead:

```
OCR Failed

↓

Retry Later

↓

Gemini Vision

↓

Continue
```

Never lose notices.

---

# Branch Strategy

Main branches:

```
main

develop
```

Feature branches:

```
feature/scraper

feature/ocr

feature/gemini

feature/calendar

feature/android

feature/api

bugfix/ocr-timeout

hotfix/database
```

Never commit directly to `main`.

---

# Development Workflow

1.

Create feature branch.

```
git checkout develop

git pull

git checkout -b feature/new-feature
```

---

2.

Implement feature.

---

3.

Run tests.

---

4.

Commit.

```
git add .

git commit -m "feat(scraper): implement duplicate detection"
```

---

5.

Push.

```
git push origin feature/new-feature
```

---

6.

Open Pull Request.

---

# Commit Convention

Use Conventional Commits.

Examples:

```
feat(scraper): detect new notices

feat(api): add notice endpoint

fix(ocr): improve confidence calculation

fix(gemini): retry failed requests

docs: update architecture

refactor(worker): move OCR into queue

style(frontend): improve cards

test(api): add integration tests
```

---

# Coding Standards

## TypeScript

Always use:

```
strict mode
```

Avoid:

```
any
```

Prefer:

```
interface

type

zod validation
```

---

## Python

Use:

PEP8

Type hints

Small functions

Meaningful names

Avoid large files.

---

# Folder Responsibilities

## frontend/

Contains:

Student Website

Admin Dashboard

UI Components

No OCR logic.

No scraping.

---

## backend/

Contains:

API Routes

Authentication

Business Logic

Database Access

---

## scraper/

Responsibilities:

Download HTML

Extract Notice Links

Duplicate Detection

Create Processing Jobs

Nothing else.

---

## workers/

Contains background workers.

Example:

OCR Worker

Gemini Worker

Distribution Worker

---

## ocr/

Contains:

EasyOCR

PDF Conversion

Confidence Calculation

Temporary File Handling

---

## gemini/

Contains:

Prompt Templates

Vision Processing

Text Processing

JSON Validation

No OCR.

---

## distribution/

Generates:

Website

WhatsApp

Telegram

Calendar

Notifications

---

## shared/

Contains:

Utilities

Constants

Logger

Validators

Shared Types

---

# AI Development Guidelines

Gemini should always return JSON.

Never request plain text.

Example:

```
{
"title":"",
"summary":"",
"translation":"",
"category":"",
"audience":[],
"important_dates":[]
}
```

Always validate responses.

Never trust AI output blindly.

---

# OCR Guidelines

EasyOCR is the primary OCR engine.

Gemini Vision is the fallback.

Decision:

```
OCR Available?

↓

NO

↓

Gemini Vision

↓

Done
```

If OCR available:

```
Confidence >= Threshold

↓

Gemini Text

Else

↓

Gemini Vision
```

OCR should never directly publish notices.

---

# Database Rules

Every published notice must contain:

Title

Summary

Category

Audience

Translation

Status

Slug

Created Date

Processing Method

PDF URL

Source URL

---

# Job Queue

Every notice becomes a processing job.

States:

```
pending

scraped

downloaded

ocr

vision

processed

published

failed
```

Never process notices synchronously.

Workers should consume jobs.

---

# API Design

REST naming conventions.

Good:

```
GET /api/notices

GET /api/notices/:slug

POST /api/notices

POST /api/publish
```

Avoid:

```
/getNotice

/createNotice

/deleteNotice
```

---

# Environment Variables

Never commit:

```
.env

.env.local
```

Instead provide:

```
.env.example
```

---

# Error Logging

Never use:

```
console.log()
```

for production debugging.

Use centralized logging.

Every worker should log:

Job ID

Notice ID

Execution Time

Error

Retry Count

---

# Security

Never expose:

Gemini API Key

Supabase Service Role Key

JWT Secrets

Database Passwords

Never hardcode credentials.

---

# Testing

Before opening a PR:

Verify:

✔ Scraper

✔ OCR

✔ AI

✔ Database

✔ API

✔ Publish

If applicable.

---

# Documentation

Whenever architecture changes:

Update:

```
docs/

ARCHITECTURE.md

API.md

DATABASE.md

AI_PIPELINE.md

ROADMAP.md
```

Documentation is part of the codebase.

---

# Pull Request Checklist

Before merging:

- Feature works.

- No console errors.

- Environment variables documented.

- Tests executed.

- Documentation updated.

- No secrets committed.

- Branch up to date.

---

# Future Contributors

Planned modules:

- Android Application

- Website

- Telegram Bot

- WhatsApp Automation

- Email Notifications

- Analytics Dashboard

- Multi-University Support

- AI Chatbot

- Recommendation Engine

---

# Project Vision

The  Notice Intelligence Platform is not just a notice website.

It is a scalable **AI-powered Notice Intelligence & Distribution Platform** designed to transform static university notices into structured, searchable, multilingual, and actionable information.

Every contribution should move the project toward:

- Better accessibility
- Higher automation
- Lower operational cost
- Better student experience
- Modular architecture
- Production-grade reliability

Thank you for contributing  ❤️