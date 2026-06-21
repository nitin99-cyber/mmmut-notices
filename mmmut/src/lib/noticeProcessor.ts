/**
 * Notice Processor — orchestrates the full pipeline
 *
 * This module is the glue between:
 *   1. OCR service (FastAPI / EasyOCR)
 *   2. Decision engine (noticeRouter)
 *   3. Gemini AI processing (text or vision)
 *   4. Database (Supabase)
 */

import { shouldUseVision } from "./noticeRouter";
import {
  processNoticeFromText,
  processNoticeFromVision,
  ProcessedNotice,
} from "./geminiProcessor";

export type { ProcessedNotice };

export interface OcrResult {
  method: string;
  text: string;
  confidence: number;
  character_count: number;
}

export interface PipelineResult {
  ocr: OcrResult;
  decision: {
    use_vision: boolean;
    reason: string;
  };
  notice: ProcessedNotice;
}

export async function runPipeline(
  ocrData: OcrResult,
  pdfBuffer?: Buffer
): Promise<PipelineResult> {
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
    notice = await processNoticeFromVision(pdfBuffer);
  } else {
    notice = await processNoticeFromText(ocrData.text);
  }

  return {
    ocr: ocrData,
    decision: {
      use_vision: useVision,
      reason: useVision
        ? `Confidence (${ocrData.confidence}%) too low or text too short (${ocrData.character_count} chars) → using Gemini Vision`
        : `Confidence (${ocrData.confidence}%) sufficient with ${ocrData.character_count} chars → using Gemini Text`,
    },
    notice,
  };
}