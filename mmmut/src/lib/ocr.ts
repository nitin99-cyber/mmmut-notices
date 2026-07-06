/**
 * OCR Client — communicates with the EasyOCR service (Railway)
 *
 * Features:
 *   - Configurable service URL via OCR_SERVICE_URL env variable
 *   - Health check before processing (checkOcrHealth)
 *   - Timeout handling (10 seconds for health, 60 seconds for OCR)
 *   - Returns page_count for large notice detection
 *   - Falls back gracefully when service is unavailable
 */

export interface OcrResponse {
  method: string;
  text: string;
  confidence: number;
  character_count: number;
  page_count: number;
  pages_processed: number;
  image_base64: string;
}

export interface OcrHealthStatus {
  available: boolean;
  latency_ms?: number;
  error?: string;
}

const OCR_SERVICE_URL =
  process.env.OCR_SERVICE_URL ||
  process.env.NEXT_PUBLIC_OCR_SERVICE_URL ||
  "http://127.0.0.1:8000";

const HEALTH_TIMEOUT_MS = 10_000; // 10 seconds
const OCR_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Check if the EasyOCR service is healthy and available.
 * If this returns { available: false }, the pipeline should
 * skip OCR and go directly to Gemini Vision.
 */
export async function checkOcrHealth(): Promise<OcrHealthStatus> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT_MS
    );

    const response = await fetch(
      `${OCR_SERVICE_URL}/health`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        available: false,
        error: `Health check returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      available: data.status === "healthy",
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      available: false,
      latency_ms: Date.now() - start,
      error:
        error instanceof Error
          ? error.message
          : "OCR service unreachable",
    };
  }
}

/**
 * Send a PDF file to the EasyOCR service for text extraction.
 *
 * @param file    - The PDF file to process
 * @param maxPages - Max pages to OCR (default 1, use 1 for large notices)
 * @returns       - Extracted text, confidence, page count, and base64 image
 */
export async function processOCR(
  file: File,
  maxPages: number = 1
): Promise<OcrResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OCR_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${OCR_SERVICE_URL}/ocr?max_pages=${maxPages}`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OCR service returned ${response.status}: ${errorText}`
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `OCR request timed out after ${OCR_TIMEOUT_MS}ms`
      );
    }
    throw error;
  }
}