/**
 * Notice Processor — orchestrates the full AI pipeline
 *
 * This module is the glue between:
 *   1. OCR service (FastAPI / EasyOCR on Railway)
 *   2. Health check (is OCR available?)
 *   3. Decision engine (noticeRouter — vision vs text, large vs normal)
 *   4. Gemini/Groq AI processing (text or vision, with fallback chain)
 *   5. Calendar event generation
 *   6. WhatsApp message formatting
 *
 * Pipeline flow:
 *   PDF → Check OCR Health → OCR (if available) → Decide Path →
 *   Gemini/Groq → Structured JSON → Calendar URLs → WhatsApp Message
 *
 * Fallback chain:
 *   EasyOCR → (if down) → Gemini Vision → (if down) → Groq Vision
 *   EasyOCR → (if good) → Gemini Text → (if down) → Groq Text
 */

import { checkOcrHealth, processOCR, type OcrResponse } from "./ocr";
import { shouldUseVision, detectLargeNotice } from "./noticeRouter";
import {
  processNoticeFromText,
  processNoticeFromVision,
  type ProcessedNotice,
} from "./geminiProcessor";
import { formatWhatsAppMessage } from "./whatsapp";

export type { ProcessedNotice };

export interface OcrResult {
  method: string;
  text: string;
  confidence: number;
  character_count: number;
  page_count: number;
  pages_processed: number;
  image_base64?: string;
}

export interface PipelineResult {
  ocr: OcrResult | null;
  ocr_health: {
    available: boolean;
    latency_ms?: number;
    error?: string;
  };
  decision: {
    use_vision: boolean;
    is_large_notice: boolean;
    reason: string;
  };
  notice: ProcessedNotice;
  whatsapp_message: string;
}

/**
 * Run the complete notice processing pipeline.
 *
 * @param file      - The PDF file to process
 * @param pdfBuffer - Raw PDF buffer (for Vision fallback)
 * @param pdfUrl    - Original PDF URL (for WhatsApp message links)
 * @returns Complete pipeline result with processed notice
 */
export async function runPipeline(
  file: File,
  pdfBuffer: Buffer,
  pdfUrl?: string
): Promise<PipelineResult> {
  console.log("🚀 Pipeline starting...");

  // ─── Step 1: Check OCR Health ──────────────────────────────────

  console.log("🏥 Checking OCR service health...");
  const ocrHealth = await checkOcrHealth();
  console.log(
    ocrHealth.available
      ? `✅ OCR service healthy (${ocrHealth.latency_ms}ms)`
      : `⚠️ OCR service unavailable: ${ocrHealth.error}`
  );

  // ─── Step 2: OCR (if available) ────────────────────────────────

  let ocrResult: OcrResult | null = null;
  let useVision = true;
  let isLargeNotice = false;
  let largeNoticeReason = "";
  let pageCount = 1;

  if (ocrHealth.available) {
    try {
      console.log("📄 Sending PDF to EasyOCR...");
      const ocrResponse = await processOCR(file, 1); // Only first page

      ocrResult = {
        method: ocrResponse.method,
        text: ocrResponse.text,
        confidence: ocrResponse.confidence,
        character_count: ocrResponse.character_count,
        page_count: ocrResponse.page_count,
        pages_processed: ocrResponse.pages_processed,
        image_base64: ocrResponse.image_base64,
      };

      pageCount = ocrResponse.page_count;

      // Check if this is a large notice
      const largeCheck = detectLargeNotice(
        pageCount,
        ocrResponse.text
      );
      isLargeNotice = largeCheck.isLarge;
      largeNoticeReason = largeCheck.reason;

      // Decide: text or vision?
      useVision = shouldUseVision(
        ocrResponse.confidence,
        ocrResponse.character_count
      );

      console.log(
        `📊 OCR result: ${ocrResponse.confidence.toFixed(1)}% confidence, ` +
          `${ocrResponse.character_count} chars, ` +
          `${pageCount} pages` +
          (isLargeNotice ? " [LARGE NOTICE]" : "")
      );
    } catch (error) {
      console.warn(
        "⚠️ OCR processing failed, falling back to Vision:",
        error instanceof Error ? error.message : error
      );
      useVision = true;
    }
  } else {
    // OCR unavailable — go straight to Vision
    useVision = true;
  }

  // ─── Step 3: AI Processing ─────────────────────────────────────

  let notice: ProcessedNotice;
  const decisionReason = !ocrHealth.available
    ? `OCR service unavailable (${ocrHealth.error}) → using Gemini Vision`
    : !ocrResult
      ? "OCR processing failed → using Gemini Vision"
      : useVision
        ? `OCR confidence (${ocrResult.confidence}%) too low or text too short (${ocrResult.character_count} chars) → using Gemini Vision`
        : `OCR confidence (${ocrResult.confidence}%) sufficient with ${ocrResult.character_count} chars → using Gemini Text`;

  console.log(`🤖 ${decisionReason}`);

  if (useVision) {
    // Vision path — send raw PDF to Gemini/Groq
    notice = await processNoticeFromVision(pdfBuffer, {
      imageBase64: ocrResult?.image_base64,
      isLargeNotice,
      pageCount,
      pdfUrl,
    });
  } else {
    // Text path — send OCR text to Gemini/Groq
    notice = await processNoticeFromText(ocrResult!.text, {
      isLargeNotice,
      pageCount,
      pdfUrl,
    });
  }

  // ─── Step 4: Generate final WhatsApp message ───────────────────

  const whatsappMsg = formatWhatsAppMessage({
    title: notice.title,
    summary: notice.summary,
    audience: notice.audience,
    important_dates: notice.important_dates,
    calendar_events: notice.calendar_events,
    pdf_url: pdfUrl,
    is_large_notice: isLargeNotice,
  });

  console.log(
    `✅ Pipeline complete: "${notice.title}" [${notice.processing_method}]` +
      (isLargeNotice ? " [LARGE]" : "")
  );

  return {
    ocr: ocrResult,
    ocr_health: ocrHealth,
    decision: {
      use_vision: useVision,
      is_large_notice: isLargeNotice,
      reason: isLargeNotice
        ? `${decisionReason} | Large notice: ${largeNoticeReason}`
        : decisionReason,
    },
    notice,
    whatsapp_message: whatsappMsg,
  };
}

/**
 * Simplified pipeline for when OCR data is already available
 * (e.g., from a previous run or manual OCR).
 *
 * @param ocrData   - Pre-existing OCR result
 * @param pdfBuffer - Raw PDF buffer (for Vision fallback)
 * @param pdfUrl    - Original PDF URL
 */
export async function runPipelineWithOcr(
  ocrData: OcrResult,
  pdfBuffer?: Buffer,
  pdfUrl?: string
): Promise<PipelineResult> {
  const pageCount = ocrData.page_count || 1;

  // Check large notice
  const largeCheck = detectLargeNotice(pageCount, ocrData.text);
  const isLargeNotice = largeCheck.isLarge;

  // Decide path
  const useVision = shouldUseVision(
    ocrData.confidence,
    ocrData.character_count
  );

  let notice: ProcessedNotice;

  if (useVision) {
    if (!pdfBuffer) {
      throw new Error(
        "Vision processing requires the original PDF buffer"
      );
    }
    notice = await processNoticeFromVision(pdfBuffer, {
      imageBase64: ocrData.image_base64,
      isLargeNotice,
      pageCount,
      pdfUrl,
    });
  } else {
    notice = await processNoticeFromText(ocrData.text, {
      isLargeNotice,
      pageCount,
      pdfUrl,
    });
  }

  const whatsappMsg = formatWhatsAppMessage({
    title: notice.title,
    summary: notice.summary,
    audience: notice.audience,
    important_dates: notice.important_dates,
    calendar_events: notice.calendar_events,
    pdf_url: pdfUrl,
    is_large_notice: isLargeNotice,
  });

  return {
    ocr: ocrData,
    ocr_health: { available: true },
    decision: {
      use_vision: useVision,
      is_large_notice: isLargeNotice,
      reason: useVision
        ? `Confidence (${ocrData.confidence}%) too low → Gemini Vision`
        : `Confidence (${ocrData.confidence}%) sufficient → Gemini Text`,
    },
    notice,
    whatsapp_message: whatsappMsg,
  };
}