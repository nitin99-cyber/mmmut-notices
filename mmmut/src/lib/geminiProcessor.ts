/**
 * Gemini AI Notice Processor
 *
 * Two processing paths:
 *   1. Text path  — OCR confidence is good → send extracted text to Gemini
 *   2. Vision path — OCR confidence is low → send the raw PDF to Gemini Vision
 *
 * Both paths produce the same structured output:
 *   - Hindi → English translation
 *   - Title extraction
 *   - Category classification
 *   - Audience identification (B.Tech 1st Year, M.Tech, PhD, etc.)
 *   - Summary generation
 *   - Important dates extraction
 */

import { getGeminiClient } from "./gemini";

// ─── Types ────────────────────────────────────────────────────────────

export interface ProcessedNotice {
  title: string;
  category: string;
  audience: string[];
  summary: string;
  english_translation: string;
  important_dates: string[];
  whatsapp_message: string;
  processing_method: "gemini_text" | "gemini_vision" | "groq_text" | "groq_vision";
  original_hindi_text?: string;
}

// ─── Shared Prompt ────────────────────────────────────────────────────

const NOTICE_CATEGORIES = [
  "Academic",
  "Examination",
  "Scholarship",
  "Hostel",
  "Placement",
  "Research",
  "Administrative",
  "Event",
  "Training/Workshop",
  "Admission",
  "Fee",
  "Sports",
  "Library",
  "Other",
] as const;

const AUDIENCE_OPTIONS = [
  "All Students",
  "B.Tech 1st Year",
  "B.Tech 2nd Year",
  "B.Tech 3rd Year",
  "B.Tech 4th Year",
  "B.Tech All Years",
  "M.Tech Students",
  "MBA Students",
  "MCA Students",
  "PhD Scholars",
  "Faculty",
  "Staff",
  "Hostel Residents",
  "Day Scholars",
  "Research Scholars",
  "All Departments",
  "Computer Science",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electronics Engineering",
  "Information Technology",
  "Chemical Engineering",
] as const;

function buildSystemPrompt(): string {
  return `You are an expert university notice analyzer for MMMUT (Madan Mohan Malaviya University of Technology, Gorakhpur).

Your job is to analyze Hindi university notices and produce structured English output.

You MUST respond with valid JSON only — no markdown, no code fences, no explanation outside the JSON.

The JSON must have this exact structure:
{
  "title": "Short descriptive English title for the notice (max 120 chars)",
  "category": "One of: ${NOTICE_CATEGORIES.join(", ")}",
  "audience": ["Array of who this notice is for. Pick from: ${AUDIENCE_OPTIONS.join(", ")}. Include ALL that apply."],
  "summary": "2-4 sentence English summary of the key information in the notice. Include what action students need to take, if any.",
  "english_translation": "Complete, accurate English translation of the entire Hindi notice. Preserve formatting with newlines. Include all dates, names, and details.",
  "important_dates": ["Array of important dates mentioned, in format: 'YYYY-MM-DD: Description'. If year is not mentioned, assume current year 2026. If no dates found, return empty array."],
  "whatsapp_message": "A fully formatted ready-to-send WhatsApp message. Use the exact format below."
}

Rules for whatsapp_message:
It must follow this exact template structure (including emojis and markdown bolding with asterisks):

📢 MMMUT NOTICE UPDATE

🎯 Audience: [Insert comma-separated audience here]

📌 Notice: [Insert Title here]

📝 Summary:
[Insert Summary here]

📅 Important Dates:
• [Insert date 1]
• [Insert date 2]

🔗 Read Full Notice:
https://notices[id].nitin.me
If no dates are present, omit the Important Dates section.
Leave the [ID] exactly as '[ID]' at the end of the URL.

Rules:
- The translation must be COMPLETE — do not skip any part of the notice.
- If the notice mentions specific branches (CSE, ECE, ME, etc.), include them in the audience.
- If the notice mentions specific years (1st year, 2nd year, etc.), include "B.Tech Xth Year" in audience.
- If the notice is general, use "All Students".
- For the category, pick the MOST specific match.
- Dates should be extracted accurately. Convert Hindi date formats to YYYY-MM-DD.
- The summary should highlight the MOST important actionable information.`;
}

// ─── Text Processing (Good OCR) ──────────────────────────────────────

export async function processNoticeFromText(
  ocrText: string
): Promise<ProcessedNotice> {
  const ai = getGeminiClient();

  const userPrompt = `Analyze the following Hindi university notice text extracted via OCR. Some characters may be garbled — use context to infer the correct meaning.

--- NOTICE TEXT START ---
${ocrText}
--- NOTICE TEXT END ---

Respond with the JSON structure as instructed.`;

  let raw = "";
  let method: "gemini_text" | "groq_text" = "gemini_text";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: userPrompt }],
      config: {
        systemInstruction: buildSystemPrompt(),
        temperature: 0.2,
      },
    });
    raw = response.text ?? "";
  } catch (error) {
    console.warn("Gemini Text API failed, falling back to Groq...", error);
    method = "groq_text";
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini failed and GROQ_API_KEY is not configured.");
    }
    
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });
    
    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq API error: ${errText}`);
    }
    
    const data = await groqResponse.json();
    raw = data.choices[0].message.content;
  }

  const parsed = parseGeminiResponse(raw);

  return {
    ...parsed,
    processing_method: method as any,
    original_hindi_text: ocrText,
  };
}

// ─── Vision Processing (Bad OCR → send raw PDF) ──────────────────────

export async function processNoticeFromVision(
  pdfBuffer: Buffer,
  imageBase64?: string
): Promise<ProcessedNotice> {
  const ai = getGeminiClient();

  const base64Pdf = pdfBuffer.toString("base64");

  const userPrompt =
    "This is a scanned Hindi university notice document. Read the entire document using your vision capabilities, then analyze it and respond with the JSON structure as instructed.";

  let raw = "";
  let method: "gemini_vision" | "groq_vision" = "gemini_vision";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: userPrompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Pdf,
          },
        },
      ],
      config: {
        systemInstruction: buildSystemPrompt(),
        temperature: 0.2,
      },
    });
    raw = response.text ?? "";
  } catch (error) {
    console.warn("Gemini Vision API failed, falling back to Groq Vision...", error);
    method = "groq_vision";
    
    if (!imageBase64) {
      throw new Error("Gemini failed and no base64 image provided for Groq fallback.");
    }
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini failed and GROQ_API_KEY is not configured.");
    }
    
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ] 
          }
        ],
        temperature: 0.2,
      })
    });
    
    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq Vision API error: ${errText}`);
    }
    
    const data = await groqResponse.json();
    raw = data.choices[0].message.content;
  }

  const parsed = parseGeminiResponse(raw);

  return {
    ...parsed,
    processing_method: method as any,
  };
}

// ─── Response Parser ─────────────────────────────────────────────────

function parseGeminiResponse(raw: string): Omit<
  ProcessedNotice,
  "processing_method" | "original_hindi_text"
> {
  // Strip markdown code fences if Gemini wraps the JSON
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    const data = JSON.parse(cleaned);

    return {
      title: String(data.title || "Untitled Notice").substring(0, 200),
      category: NOTICE_CATEGORIES.includes(data.category)
        ? data.category
        : "Other",
      audience: Array.isArray(data.audience)
        ? data.audience.map(String)
        : ["All Students"],
      summary: String(data.summary || "No summary available."),
      english_translation: String(
        data.english_translation || "Translation not available."
      ),
      whatsapp_message: String(data.whatsapp_message || ""),
      important_dates: Array.isArray(data.important_dates)
        ? data.important_dates.map(String)
        : [],
    };
  } catch {
    // If JSON parsing fails, return a fallback with the raw text as translation
    console.error("Failed to parse Gemini response as JSON:", cleaned);

    return {
      title: "Notice (Parse Error)",
      category: "Other",
      audience: ["All Students"],
      summary:
        "The AI response could not be parsed. The raw output is included in the translation field.",
      english_translation: raw,
      whatsapp_message: "",
      important_dates: [],
    };
  }
}
