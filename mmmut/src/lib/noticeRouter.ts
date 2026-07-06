/**
 * Decision Engine — Notice Router
 *
 * Decides the processing path based on OCR results:
 *   1. shouldUseVision — Is OCR quality good enough for text processing?
 *   2. isLargeNotice   — Does this notice have too many pages / student lists?
 *
 * Thresholds:
 *   confidence < 50   → vision (OCR too noisy)
 *   char_count < 1000 → vision (OCR extracted too little text)
 *   page_count > 2    → large notice (only first page processed)
 */

/**
 * Determine if Gemini Vision should be used instead of Gemini Text.
 *
 * @param confidence     - OCR confidence percentage (0-100)
 * @param characterCount - Number of characters extracted by OCR
 * @returns true if Vision should be used (OCR quality is insufficient)
 */
export function shouldUseVision(
  confidence: number,
  characterCount: number
): boolean {
  return confidence < 50 || characterCount < 1000;
}

/**
 * Determine if a notice is "large" (multi-page student lists, hostel
 * allotments, roll number lists, etc.)
 *
 * Large notices:
 *   - Only have their first page processed by AI
 *   - Include the original PDF link in the WhatsApp message
 *   - Display "View full list in PDF" instead of processing all pages
 *
 * @param pageCount - Total pages in the PDF
 * @param ocrText   - Extracted text from the first page (optional, for content analysis)
 * @returns Object with isLarge flag and the reason
 */
export function detectLargeNotice(
  pageCount: number,
  ocrText?: string
): { isLarge: boolean; reason: string } {
  // Rule 1: More than 2 pages is likely a list-type notice
  if (pageCount > 2) {
    return {
      isLarge: true,
      reason: `Notice has ${pageCount} pages (threshold: >2)`,
    };
  }

  // Rule 2: Content analysis — check if text contains patterns
  // typical of student lists (roll numbers, serial numbers, etc.)
  if (ocrText) {
    const listPatterns = [
      /\b\d{2}[A-Z]{2,4}\d{3,4}\b/gi, // Roll numbers like 21CS001
      /\bS\.?\s*No\.?\s*\d+/gi, // S.No. 1, S.No 2
      /\b(क्रम|अनुक्रम)\s*(सं|स)/gi, // Hindi serial number headers
      /\b(hostel|छात्रावास)\b/gi, // Hostel-related
    ];

    const matchCount = listPatterns.reduce((count, pattern) => {
      const matches = ocrText.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);

    // If we find many list-like patterns, it's a large notice
    if (matchCount >= 10) {
      return {
        isLarge: true,
        reason: `Content contains ${matchCount} list-pattern matches (likely a student list)`,
      };
    }
  }

  return {
    isLarge: false,
    reason:
      pageCount <= 2
        ? `Normal notice (${pageCount} page${pageCount === 1 ? "" : "s"})`
        : "Content does not match list patterns",
  };
}