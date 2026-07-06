# API Documentation

## Base URLs

| Environment | Service | Base URL |
|-------------|---------|----------|
| **Production** | Admin Panel + API | `https://admin.notices.mmmut.app` |
| **Production** | OCR Service | `https://<project>.up.railway.app` |
| **Development** | Admin Panel + API | `http://localhost:3000` |
| **Development** | OCR Service | `http://localhost:8000` |

All API routes are prefixed with `/api` on the Admin/API service. The OCR service has top-level routes.

---

## Authentication

The API uses three authentication levels depending on the endpoint type:

| Level | Method | Used By | Endpoints |
|-------|--------|---------|-----------|
| **Public** | No authentication | Future Android app | `GET /api/notices`, `GET /api/categories`, etc. |
| **Admin** | JWT Bearer token (Supabase Auth) | Admin Panel | `POST /api/admin/*`, `PUT /api/admin/*`, `DELETE /api/admin/*` |
| **Internal** | API Secret header | Scraper, internal services | `POST /api/process-notice`, `POST /api/scraper/trigger` |

### Admin Authentication

Admin endpoints require a valid Supabase JWT in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The JWT is obtained via Supabase Auth (email/password login through the Admin Panel UI).

### Internal Authentication

Internal endpoints require the `x-api-secret` header:

```http
x-api-secret: your-api-secret-here
```

This secret is shared between the scraper (GitHub Actions) and the API (Vercel) via environment variables.

---

## Admin APIs

These endpoints power the Admin Panel and require JWT authentication.

---

### Upload Notice PDF

Upload a PDF manually for AI processing.

```http
POST /api/admin/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt>
```

**Request body (form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file to process |
| `title` | string | Yes | Notice title |
| `published_date` | string | No | Notice date (YYYY-MM-DD), defaults to today |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "status": "pending",
    "message": "PDF uploaded successfully. Processing will begin shortly."
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_FILE` | File is not a valid PDF |
| 400 | `MISSING_TITLE` | Title field is required |
| 413 | `FILE_TOO_LARGE` | PDF exceeds 10MB limit |

---

### Publish Notice

Mark a processed notice as published (ready for WhatsApp distribution).

```http
POST /api/admin/publish/:noticeId
Authorization: Bearer <jwt>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "status": "published",
    "published_at": "2026-07-06T04:00:00.000Z",
    "whatsapp_message": "📢 *Exam Schedule - B.Tech 3rd Year*\n\n📝 End semester exams from July 15 to Aug 2, 2026.\n\n⚠️ Form submission deadline: July 10\n\n📅 Add to Calendar: https://calendar.google.com/...\n\n🔗 View notice: https://mmmut.ac.in/..."
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOTICE_NOT_FOUND` | Notice ID does not exist |
| 409 | `ALREADY_PUBLISHED` | Notice is already published |
| 422 | `NOT_PROCESSED` | Notice has not been processed yet (job still pending/processing) |

---

### Archive Notice

Move a notice to the archived state (hidden from public APIs but not deleted).

```http
POST /api/admin/archive/:noticeId
Authorization: Bearer <jwt>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "status": "archived",
    "archived_at": "2026-07-06T04:30:00.000Z"
  }
}
```

---

### Edit Notice

Edit the AI-generated output before publishing. Admins can correct the summary, re-categorize, add/remove dates, or modify the WhatsApp message.

```http
PUT /api/admin/notices/:noticeId
Content-Type: application/json
Authorization: Bearer <jwt>
```

**Request body:**

```json
{
  "title": "Updated Title (optional)",
  "summary": "Corrected summary text (optional)",
  "english_translation": "Updated translation (optional)",
  "category": "examination",
  "audience": ["B.Tech", "3rd Year"],
  "important_dates": [
    { "title": "Exams Begin", "date": "2026-07-15" }
  ],
  "whatsapp_message": "Manually edited WhatsApp message (optional)",
  "calendar_events": [
    { "title": "MMMUT: Exams Begin", "date": "2026-07-15", "description": "..." }
  ]
}
```

> [!NOTE]
> All fields are optional. Only the fields included in the request body will be updated. Omitted fields retain their current values.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "updated_fields": ["title", "summary", "category"],
    "updated_at": "2026-07-06T04:15:00.000Z"
  }
}
```

---

### Delete Notice

Soft delete a notice. The record is marked as deleted but not removed from the database.

```http
DELETE /api/admin/notices/:noticeId
Authorization: Bearer <jwt>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "deleted_at": "2026-07-06T04:45:00.000Z"
  }
}
```

---

### List Notices

Retrieve all notices with filtering and pagination.

```http
GET /api/admin/notices?status=draft&page=1&limit=20
Authorization: Bearer <jwt>
```

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `all` | Filter: `draft`, `published`, `archived`, `all` |
| `category` | string | — | Filter by category |
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Results per page (max 100) |
| `search` | string | — | Search in title and summary |
| `sort` | string | `created_at` | Sort field: `created_at`, `published_at`, `title` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notices": [
      {
        "id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
        "title": "End Semester Examination Schedule",
        "summary": "Exam schedule for B.Tech 3rd year...",
        "category": "examination",
        "status": "draft",
        "is_large_notice": false,
        "page_count": 1,
        "processing_method": "gemini_text",
        "source_url": "https://www.mmmut.ac.in/...",
        "pdf_url": "https://www.mmmut.ac.in/...",
        "created_at": "2026-07-06T03:30:00.000Z",
        "published_at": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

### List Processing Jobs

View the processing queue with status filtering.

```http
GET /api/admin/jobs?status=failed&page=1&limit=20
Authorization: Bearer <jwt>
```

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `all` | Filter: `pending`, `processing`, `completed`, `failed`, `all` |
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
        "status": "failed",
        "processing_method": "groq_vision",
        "error_message": "Groq API rate limit exceeded",
        "retry_count": 2,
        "created_at": "2026-07-06T03:30:00.000Z",
        "updated_at": "2026-07-06T03:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

### Retry Failed Job

Re-queue a failed processing job for another attempt.

```http
POST /api/admin/jobs/:id/retry
Authorization: Bearer <jwt>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "retry_count": 3,
    "message": "Job re-queued for processing."
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 404 | `JOB_NOT_FOUND` | Job ID does not exist |
| 409 | `JOB_NOT_FAILED` | Job is not in `failed` status |
| 429 | `MAX_RETRIES` | Job has exceeded maximum retry attempts (5) |

---

## Processing APIs (Internal)

These endpoints are used internally by the scraper and processing pipeline. They require the `x-api-secret` header.

---

### Process Notice

Trigger the full AI processing pipeline for a notice.

```http
POST /api/process-notice
Content-Type: application/json
x-api-secret: <api-secret>
```

**Request body:**

```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
  "pdf_url": "https://www.mmmut.ac.in/pdf/notice-123.pdf",
  "title": "End Semester Examination Schedule",
  "published_date": "2026-07-06"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "processing_method": "gemini_text",
    "duration_ms": 4523,
    "result": {
      "title": "End Semester Examination Schedule - B.Tech 3rd Year",
      "summary": "The university has released...",
      "category": "examination",
      "important_dates": [
        { "title": "Exams Begin", "date": "2026-07-15" }
      ],
      "calendar_events": [
        { "title": "MMMUT: Exams Begin", "date": "2026-07-15", "description": "..." }
      ],
      "whatsapp_message": "📢 *Exam Schedule*..."
    }
  }
}
```

---

### Trigger Scraper

Manually trigger the web scraper (same as what the cron job does).

```http
POST /api/scraper/trigger
x-api-secret: <api-secret>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "total_notices_found": 25,
    "new_notices": 3,
    "duplicates_skipped": 22,
    "jobs_created": 3,
    "duration_ms": 2150
  }
}
```

---

### System Health Check

Check the overall health of the platform.

```http
GET /api/health
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-07-06T04:09:08.000Z",
    "services": {
      "database": "connected",
      "ocr": "healthy",
      "gemini": "available",
      "groq": "available"
    },
    "version": "1.0.0"
  }
}
```

---

### OCR Service Health

Check the availability of the EasyOCR service on Railway.

```http
GET /api/health/ocr
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "url": "https://<project>.up.railway.app",
    "response_time_ms": 120,
    "timestamp": "2026-07-06T04:09:08.000Z"
  }
}
```

**Response when OCR is down (200 OK — not an error, pipeline can function without OCR):**

```json
{
  "success": true,
  "data": {
    "status": "unavailable",
    "url": "https://<project>.up.railway.app",
    "error": "Connection timeout after 5000ms",
    "fallback": "Gemini Vision will be used for PDF processing",
    "timestamp": "2026-07-06T04:09:08.000Z"
  }
}
```

---

## OCR Service APIs (Railway)

These endpoints are served by the EasyOCR FastAPI application running on Railway.

---

### Process PDF with OCR

Extract text from a PDF using EasyOCR.

```http
POST /ocr
Content-Type: multipart/form-data
```

**Request body (form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file to process |
| `first_page_only` | boolean | No | If `true`, only process the first page (default: `false`) |

**Response (200 OK):**

```json
{
  "text": "Madan Mohan Malaviya University of Technology\nGorakhpur\n\nNotice\n\nIt is hereby notified that the end semester examinations...",
  "confidence": 78.5,
  "character_count": 2450,
  "page_count": 2,
  "image_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "processing_time_ms": 3200
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Extracted text from all processed pages |
| `confidence` | float | Average OCR confidence score (0–100) |
| `character_count` | integer | Total characters in extracted text |
| `page_count` | integer | Number of pages in the PDF |
| `image_base64` | string | Base64-encoded image of the first page (for Gemini Vision fallback) |
| `processing_time_ms` | integer | Time taken for OCR processing |

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_FILE` | Uploaded file is not a valid PDF |
| 413 | `FILE_TOO_LARGE` | PDF exceeds 20MB limit |
| 500 | `OCR_ERROR` | EasyOCR internal error |
| 503 | `MODEL_LOADING` | EasyOCR model is still loading (cold start) |

---

### OCR Health Check

```http
GET /health
```

**Response (200 OK):**

```json
{
  "status": "healthy",
  "timestamp": "2026-07-06T04:09:08.000Z",
  "model_loaded": true,
  "uptime_seconds": 3600
}
```

---

## Public APIs (Future — for Android App)

> [!IMPORTANT]
> These endpoints are planned for Phase 2 (Android App). They are **not yet implemented** but documented here for planning purposes.

These endpoints will be publicly accessible without authentication and will only return published notices.

---

### List Published Notices

```http
GET /api/notices?page=1&limit=20&category=examination
```

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 50) |
| `category` | string | — | Filter by category |
| `search` | string | — | Full-text search in title and summary |
| `after` | string | — | ISO date — return notices published after this date |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notices": [
      {
        "id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
        "slug": "end-semester-examination-schedule-btech-3rd-year",
        "title": "End Semester Examination Schedule - B.Tech 3rd Year",
        "summary": "The university has released the examination schedule...",
        "category": "examination",
        "audience": ["B.Tech", "3rd Year"],
        "important_dates": [
          { "title": "Exams Begin", "date": "2026-07-15" }
        ],
        "is_large_notice": false,
        "pdf_url": "https://www.mmmut.ac.in/...",
        "source_url": "https://www.mmmut.ac.in/AllRecord",
        "published_at": "2026-07-06T04:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "total_pages": 8,
      "has_next": true
    }
  }
}
```

---

### Get Notice Detail

```http
GET /api/notices/:slug
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "slug": "end-semester-examination-schedule-btech-3rd-year",
    "title": "End Semester Examination Schedule - B.Tech 3rd Year",
    "summary": "The university has released the examination schedule for B.Tech 3rd year students...",
    "english_translation": "Full English translation if the original was in Hindi...",
    "category": "examination",
    "audience": ["B.Tech", "3rd Year"],
    "important_dates": [
      { "title": "Exams Begin", "date": "2026-07-15" },
      { "title": "Exams End", "date": "2026-08-02" },
      { "title": "Form Deadline", "date": "2026-07-10" }
    ],
    "calendar_events": [
      {
        "title": "MMMUT: Exams Begin - B.Tech 3rd Year",
        "date": "2026-07-15",
        "description": "End semester examinations begin",
        "calendar_url": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=MMMUT%3A+Exams+Begin&dates=20260715/20260716&details=End+semester+examinations+begin"
      }
    ],
    "is_large_notice": false,
    "page_count": 1,
    "pdf_url": "https://www.mmmut.ac.in/...",
    "source_url": "https://www.mmmut.ac.in/AllRecord",
    "published_at": "2026-07-06T04:00:00.000Z"
  }
}
```

---

### Search Notices

```http
GET /api/search?q=examination&category=examination&limit=10
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 characters) |
| `category` | string | No | Filter by category |
| `limit` | integer | No | Max results (default 20, max 50) |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "query": "examination",
    "results": [
      {
        "id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
        "slug": "end-semester-examination-schedule-btech-3rd-year",
        "title": "End Semester Examination Schedule - B.Tech 3rd Year",
        "summary": "The university has released...",
        "category": "examination",
        "published_at": "2026-07-06T04:00:00.000Z",
        "relevance_score": 0.95
      }
    ],
    "total": 12
  }
}
```

---

### List Categories

```http
GET /api/categories
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "categories": [
      { "name": "examination", "label": "Examination", "count": 45 },
      { "name": "academic", "label": "Academic", "count": 38 },
      { "name": "admission", "label": "Admission", "count": 22 },
      { "name": "hostel", "label": "Hostel", "count": 15 },
      { "name": "placement", "label": "Placement", "count": 12 },
      { "name": "scholarship", "label": "Scholarship", "count": 8 },
      { "name": "event", "label": "Events", "count": 7 },
      { "name": "administrative", "label": "Administrative", "count": 5 },
      { "name": "result", "label": "Results", "count": 3 },
      { "name": "other", "label": "Other", "count": 2 }
    ]
  }
}
```

---

### Upcoming Deadlines

Returns notices with future important dates, sorted by nearest deadline.

```http
GET /api/deadlines?limit=10
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "deadlines": [
      {
        "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
        "notice_title": "End Semester Examination Schedule",
        "deadline_title": "Form Submission Deadline",
        "date": "2026-07-10",
        "days_remaining": 4,
        "category": "examination",
        "calendar_url": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=...",
        "pdf_url": "https://www.mmmut.ac.in/..."
      }
    ]
  }
}
```

---

### Calendar Event Data

Get calendar event details for a specific notice.

```http
GET /api/calendar/:noticeId
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notice_id": "f0e1d2c3-b4a5-6789-0fed-cba987654321",
    "notice_title": "End Semester Examination Schedule",
    "events": [
      {
        "title": "MMMUT: Exams Begin - B.Tech 3rd Year",
        "date": "2026-07-15",
        "description": "End semester examinations begin for B.Tech 3rd year students",
        "google_calendar_url": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=MMMUT%3A+Exams+Begin&dates=20260715/20260716&details=End+semester+examinations+begin",
        "ical_data": "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:MMMUT: Exams Begin\nDTSTART:20260715\nDTEND:20260716\nDESCRIPTION:End semester examinations begin\nEND:VEVENT\nEND:VCALENDAR"
      }
    ]
  }
}
```

---

## Error Format

All error responses follow a consistent JSON format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {}
  }
}
```

**Example error responses:**

```json
// 400 Bad Request
{
  "success": false,
  "error": {
    "code": "INVALID_FILE",
    "message": "Uploaded file is not a valid PDF document."
  }
}

// 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token."
  }
}

// 404 Not Found
{
  "success": false,
  "error": {
    "code": "NOTICE_NOT_FOUND",
    "message": "No notice found with the given ID.",
    "details": {
      "notice_id": "invalid-uuid-here"
    }
  }
}

// 429 Rate Limited
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retry_after_seconds": 60
    }
  }
}
```

---

## Status Codes

| Code | Meaning | Used When |
|------|---------|-----------|
| **200** | OK | Successful GET, PUT, DELETE, or action requests |
| **201** | Created | Successful POST that creates a resource (upload, job creation) |
| **400** | Bad Request | Invalid input, missing required fields, malformed data |
| **401** | Unauthorized | Missing or invalid JWT / API secret |
| **404** | Not Found | Requested resource (notice, job) does not exist |
| **409** | Conflict | Action conflicts with current state (e.g., publishing an already-published notice) |
| **413** | Payload Too Large | Uploaded file exceeds size limit |
| **422** | Unprocessable Entity | Request is valid but cannot be processed (e.g., publishing an unprocessed notice) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Unexpected server error |
| **503** | Service Unavailable | Dependent service (OCR, AI) is temporarily unavailable |

---

## Rate Limits

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Admin APIs | 100 requests | Per minute |
| Public APIs (future) | 60 requests | Per minute |
| Processing APIs | 10 requests | Per minute |
| OCR Service | 5 requests | Per minute |

> [!NOTE]
> Rate limits are currently soft-enforced. The primary bottleneck is the AI provider rate limits (Gemini: 15 RPM, Groq: 30 RPM), not the API itself.