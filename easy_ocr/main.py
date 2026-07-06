"""
MMMUT Notice Intelligence Platform — EasyOCR Service

Deployed on Railway (free tier).
Provides OCR text extraction from PDF notices using EasyOCR.

Endpoints:
  GET  /health  → Service health check
  POST /ocr     → Extract text from PDF (first page by default)

When this service is unavailable, the admin panel falls back to Gemini Vision.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import fitz  # PyMuPDF
import tempfile
import os
import base64
from datetime import datetime, timezone

app = FastAPI(
    title="MMMUT OCR Service",
    description="EasyOCR-based text extraction for university notice PDFs",
    version="2.0.0",
)

# CORS — allow admin panel (Vercel) to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR reader (Hindi + English)
# This loads the model into memory on startup
reader = easyocr.Reader(["hi", "en"], gpu=False)


# ─── Health Check ─────────────────────────────────────────────────────


@app.get("/health")
async def health_check():
    """
    Health endpoint for the admin panel to check OCR availability.
    If this returns anything other than 200, the pipeline skips OCR
    and falls back to Gemini Vision.
    """
    return {
        "status": "healthy",
        "service": "easyocr",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── OCR Processing ──────────────────────────────────────────────────


@app.post("/ocr")
async def process_pdf(
    file: UploadFile = File(...),
    max_pages: int = Query(default=1, ge=1, le=10, description="Max pages to OCR"),
):
    """
    Extract text from a PDF using EasyOCR.

    For large notices (student lists, hostel allotments), only the first
    page is processed. The pipeline uses `page_count` to detect large
    notices and includes the original PDF link in WhatsApp messages.

    Returns:
        method: "easyocr"
        text: Extracted text from processed pages
        confidence: Average OCR confidence (0-100)
        character_count: Total characters extracted
        page_count: Total pages in the PDF
        pages_processed: How many pages were actually OCR'd
        image_base64: Base64 encoded image of the first page
    """

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted",
        )

    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=".pdf"
    ) as temp_pdf:
        content = await file.read()
        temp_pdf.write(content)
        pdf_path = temp_pdf.name

    temp_files = [pdf_path]

    try:
        # Open PDF and get total page count
        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Determine how many pages to process
        pages_to_process = min(max_pages, total_pages)

        all_text_parts = []
        all_confidences = []
        first_page_image_b64 = ""

        for page_idx in range(pages_to_process):
            page = doc[page_idx]

            # Render page to image (2x scale for better OCR)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            image_path = pdf_path.replace(
                ".pdf", f"_page{page_idx}.png"
            )
            pix.save(image_path)
            temp_files.append(image_path)

            # Save first page image as base64 for potential Gemini Vision fallback
            if page_idx == 0:
                with open(image_path, "rb") as img_file:
                    first_page_image_b64 = base64.b64encode(
                        img_file.read()
                    ).decode("utf-8")

            # Run EasyOCR on this page
            results = reader.readtext(image_path)

            for result in results:
                text = result[1]
                confidence = result[2]
                all_text_parts.append(text)
                all_confidences.append(confidence)

        doc.close()

        # Combine results
        extracted_text = "\n".join(all_text_parts)

        avg_confidence = 0.0
        if all_confidences:
            avg_confidence = (
                sum(all_confidences) / len(all_confidences)
            ) * 100

        return {
            "method": "easyocr",
            "text": extracted_text,
            "confidence": round(avg_confidence, 2),
            "character_count": len(extracted_text),
            "page_count": total_pages,
            "pages_processed": pages_to_process,
            "image_base64": first_page_image_b64,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}",
        )

    finally:
        # Clean up all temp files
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except OSError:
                pass