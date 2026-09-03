import { GoogleGenAI } from "@google/genai";

/**
 * Gemini AI client — lazy initialization.
 * Only created when actually needed (not at module load time).
 */
let _ai: GoogleGenAI | null = null;
let _aiFallback: GoogleGenAI | null = null;

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

export function getGeminiFallbackClient(): GoogleGenAI | null {
  if (_aiFallback) return _aiFallback;
  const apiKey = process.env.GEMINI_FALLBACK_API_KEY;
  if (!apiKey) return null;
  _aiFallback = new GoogleGenAI({ apiKey });
  return _aiFallback;
}