/**
 * Decision Engine
 *
 * Decides whether OCR output is good enough for text-based AI processing,
 * or if we need to fall back to Gemini Vision on the original PDF image.
 *
 * Thresholds:
 *   confidence < 50  → vision (OCR too noisy)
 *   char_count < 1000 → vision (OCR extracted too little text)
 */
export function shouldUseVision(
  confidence: number,
  characterCount: number
): boolean {
  return confidence < 50 || characterCount < 1000;
}