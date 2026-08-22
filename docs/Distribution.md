# Distribution Service

> Version: 2.0
> Module: Distribution Engine
> Status: Planned

---

# Overview

The Distribution Service is responsible for delivering processed notices to various platforms after they have been approved by the administrator.

The processing pipeline generates structured notice data only once.

The Distribution Service converts this structured data into platform-specific formats such as:

- Notice Website
- WhatsApp Channel
- Telegram Channel
- Google Calendar
- Future Mobile Application
- Future Email Notifications

The processing pipeline should never know where notices are distributed.

This follows the **Single Responsibility Principle**.

---

# Philosophy

```
PDF

↓

OCR

↓

AI

↓

Structured JSON

↓

Distribution Engine

↓

Website
WhatsApp
Telegram
Calendar
Email
Mobile App
```

The AI Processing module only generates structured information.

The Distribution Engine decides how that information is presented on different platforms.

---

# Distribution Targets

Current Targets

- Website
- WhatsApp
- Telegram
- Google Calendar

Future Targets

- Android Application
- iOS Application
- Email
- Discord
- Slack
- RSS Feed
- Public API

---

# Distribution Workflow

```
Notice Published

↓

Create Distribution Job

↓

Website Publisher

↓

WhatsApp Publisher

↓

Telegram Publisher

↓

Calendar Publisher

↓

Completed
```

Each publisher is independent.

Failure in one publisher must never stop another publisher.

Example

```
Website

✓ Success

↓

WhatsApp

✓ Success

↓

Telegram

✗ Failed

↓

Calendar

✓ Success
```

Result

Website remains published.

Telegram retry job created.

---

# Publish Trigger

Distribution begins only when

Notice Status

```
published
```

Draft notices are never distributed.

---

# Structured Notice Object

Every publisher receives the same object.

```json
{
    "id": "",
    "slug": "",
    "title": "",
    "summary": "",
    "translation": "",
    "category": "",
    "audience": [],
    "important_dates": [],
    "pdf_url": "",
    "source_url": "",
    "page_count": 0,
    "is_large_notice": false
}
```

No publisher should perform OCR or AI processing.

---

# Website Publisher

Purpose

Publish notices on the public website.

Input

Structured Notice JSON

Output

Dynamic Notice Page

Example URL

```
/notices/phd-registration-2026
```

Website should display

- Title
- Summary
- Category
- Audience
- Important Dates
- English Translation
- Original Hindi Notice
- Download Original PDF
- Share Button
- Add To Calendar

Large Notices

If

```
is_large_notice = true
```

Display

- First page summary
- Important instructions
- Download original PDF

Do NOT render thousands of student names.

---

# WhatsApp Publisher (Automated via OpenWA)

Purpose

Generate WhatsApp-ready formatted messages and automatically broadcast them to the MMMUT WhatsApp Channel/Group via the self-hosted **OpenWA** API Gateway.

Automated Publishing Rules

1. **Strict Parse Validation**: Only notices that have been successfully parsed without errors (valid title, summary, translation, and WhatsApp message) are broadcasted.
2. **Failure Protection**: If AI parsing fails, WhatsApp broadcast is blocked, and an email failure alert is sent to the admin for manual review.
3. **Duplicate Prevention**: The `sent` / `whatsapp_sent` status is recorded in the database to prevent duplicate broadcasts.
4. **Manual Triggering**: Administrators can also preview and manually trigger broadcasting from the Admin Dashboard.

Configuration

```env
OPENWA_BASE_URL=http://localhost:2785
OPENWA_API_KEY=your_api_key
OPENWA_SESSION_ID=default
OPENWA_CHANNEL_JID=120363xxxxxx@newsletter
AUTO_PUBLISH_WHATSAPP=true
```

Message Format Example

📢 *MMMUT NOTICE UPDATE*

🎯 *Audience:* All Students

📌 *Notice:* End Semester Examination Schedule 2026

📝 *Summary:*
End semester examination schedule for all undergraduate courses has been released. Exams commence from 15th July 2026.

📅 *Important Dates:*
• 2026-07-15: Examination Start Date

🗓️ *Add to Calendar:*
• Exam Start: https://calendar.google.com/...

🔗 *Original Notice:*
https://mmmut.ac.in/notices/exam-schedule-2026.pdf

━━━━━━━━━━━━━━━━━
_MMMUT Notice Intelligence_


---

# Telegram Publisher

Similar to WhatsApp.

Supports richer formatting.

Can include

- Category
- Summary
- Deadline
- Link

Future

Telegram Bot Auto Publish.

---

# Calendar Publisher

Purpose

Convert extracted important dates into Google Calendar events.

Input

```
important_dates
```

Example

```json
[
    {
        "title":"PhD Registration Deadline",
        "date":"2026-06-30"
    }
]
```

Website

Student clicks

```
Add to Calendar
```

Generated

Google Calendar Event

Fields

Title

Date

Description

Website URL

Only deadline events should be added.

Never create events for general notices.

---

# Share Link Generator

Every published notice gets

```
share_url
```

Example

```
https://notice.nexsus.in/notices/phd-registration-2026
```

Used by

WhatsApp

Telegram

Future Mobile App

QR Codes

---

# Large Notice Handling

Examples

Hostel Allotment

Scholarship List

Examination Seating Plan

Roll Number Lists

These notices often contain

Thousands of names.

Website

Show

Summary

Instructions

Original PDF

Message

"The complete student list is available in the original PDF."

WhatsApp

Never include student lists.

Only include

Summary

Website Link

---

# Distribution Queue

Publishing should be asynchronous.

```
Notice Published

↓

distribution_jobs

↓

Worker

↓

Publish
```

Table

distribution_jobs

Columns

id

notice_id

channel

status

retry_count

error_message

created_at

completed_at

---

# Retry Policy

Maximum retries

3

Example

Telegram API Failure

↓

Retry

↓

Retry

↓

Retry

↓

Mark Failed

Administrator can manually retry.

---

# Distribution Status

Each notice stores

Website

Published

WhatsApp

Generated

Telegram

Generated

Calendar

Generated

Future

Email

Pending

This allows partial success.

---

# Website Caching

Published notices should be cached.

Reasons

Fast loading

Reduced database load

Improved SEO

Cache invalidated

Only after notice update.

---

# Future Push Notifications

Instead of polling,

Future Android App

↓

Firebase Cloud Messaging

↓

New Notice

↓

Push Notification

Payload

Title

Summary

Notice URL

---

# Analytics

Track

Website Views

WhatsApp Clicks

Telegram Clicks

Calendar Adds

Most Viewed Notices

Most Shared Notices

Search Queries

Purpose

Improve student experience.

---

# Security

Only published notices are public.

Draft notices require admin authentication.

Share URLs are public.

Admin APIs require authentication.

---

# Versioning

Every published notice is immutable.

Editing creates

Version 2

Students continue reading Version 1 until Version 2 is published.

History maintained.

---

# Future Distribution Channels

- Android App
- Email
- 
- 
- REST API
- GraphQL API

No change required in AI Processing.

Only a new Publisher module needs to be implemented.

---

# Design Principles

✔ AI processes once.

✔ Distribute everywhere.

✔ Every publisher is independent.

✔ Failure in one channel never blocks another.

✔ Large notices remain lightweight.

✔ Website acts as the canonical source.

✔ WhatsApp and Telegram redirect users to the website.

✔ Calendar only stores actionable deadlines.

✔ Distribution must be asynchronous.

✔ System should be extensible without changing the AI pipeline.