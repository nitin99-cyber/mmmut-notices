import { GoogleGenAI } from "@google/genai";

/**
 * Gemini AI client — lazy initialization.
 * Only created when actually needed (not at module load time).
 */
let _ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (_ai) return _ai;

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set GOOGLE_API_KEY or GEMINI_API_KEY in .env"
    );
  }

  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}