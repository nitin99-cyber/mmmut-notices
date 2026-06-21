/**
 * Mock Gemini AI Processing
 *
 * Simulates what the real Gemini integration will do:
 *   - Translate Hindi → English
 *   - Generate summary
 *   - Categorize notice
 *   - Identify audience
 *   - Extract important dates
 *
 * Two paths:
 *   processNoticeFromText()  → when OCR was good enough
 *   processNoticeFromVision() → when OCR failed and we'd send the image
 */

export interface ProcessedNotice {
  title: string;
  category: string;
  audience: string;
  summary: string;
  english_translation: string;
  important_dates: string[];
  processing_method: "text" | "vision";
}

export async function processNoticeFromText(
  ocrText: string
): Promise<ProcessedNotice> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Extract a rough title from the first line of OCR text
  const firstLine = ocrText.split("\n")[0] || "University Notice";

  return {
    title: firstLine.substring(0, 100),
    category: "Academic",
    audience: "All Students",
    summary:
      "This is a mock summary generated from OCR text. " +
      `The notice contains ${ocrText.length} characters of extracted text. ` +
      "Real Gemini integration will provide an actual Hindi→English translation and structured summary.",
    english_translation:
      "[Mock Translation] " +
      ocrText.substring(0, 500) +
      (ocrText.length > 500 ? "..." : ""),
    important_dates: [],
    processing_method: "text",
  };
}

export async function processNoticeFromVision(): Promise<ProcessedNotice> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    title: "Notice (Vision Processing Required)",
    category: "Unknown",
    audience: "Unknown",
    summary:
      "OCR quality was too low for text-based processing. " +
      "Vision processing with Gemini will be used once integrated.",
    english_translation:
      "[Vision processing not yet implemented — will use Gemini Vision API]",
    important_dates: [],
    processing_method: "vision",
  };
}