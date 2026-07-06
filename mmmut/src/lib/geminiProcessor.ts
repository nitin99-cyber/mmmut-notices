/**
 * Gemini AI Notice Processor
 *
 * Two processing paths:
 *   1. Text path  — OCR confidence is good → send extracted text to Gemini
 *   2. Vision path — OCR confidence is low → send the raw PDF to Gemini Vision
 *
 * Fallback chain:
 *   Gemini (primary) → Groq (fallback when Gemini fails)
 *
 * Both paths produce the same structured output:
 *   - Hindi → English translation
 *   - Title extraction
 *   - Category classification
 *   - Audience identification
 *   - Summary generation
 *   - Important dates extraction
 *   - Calendar events with Google Calendar URLs
 *   - WhatsApp-ready message with calendar links
 */

import { getGeminiClient } from "./gemini";
import { PDFDocument } from "pdf-lib";
import { generateCalendarUrl, type CalendarEvent } from "./calendar";
import { convertPdfToImageBase64 } from "./pdfToImage";

// ─── Types ────────────────────────────────────────────────────────────

export interface ProcessedNotice {
  title: string;
  category: string;
  audience: string[];
  summary: string;
  english_translation: string;
  important_dates: string[];
  calendar_events: CalendarEvent[];
  whatsapp_message: string;
  is_large_notice: boolean;
  page_count: number;
  processing_method:
    | "gemini_text"
    | "gemini_vision"
    | "groq_text"
    | "groq_vision";
  original_hindi_text?: string;
}

// ─── Constants ────────────────────────────────────────────────────────

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

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildSystemPrompt(isLargeNotice: boolean = false): string {
  const largeNoticeInstruction = isLargeNotice
    ? `
IMPORTANT — LARGE NOTICE:
This notice contains multiple pages with student lists, roll numbers, hostel allotments, or similar tabular data.
- Only the FIRST PAGE has been provided to you.
- Do NOT try to list individual students or roll numbers.
- Summarize WHAT the notice is about (e.g., "Hostel allotment list for 2026-27 session").
- Mention that the full list is available in the original PDF.
- In the whatsapp_message, include: "📄 View full list in the original PDF"
`
    : "";

  return `You are an expert university notice analyzer for MMMUT (Madan Mohan Malaviya University of Technology, Gorakhpur).

Your job is to analyze Hindi university notices and produce structured English output.

You MUST respond with valid JSON only — no markdown, no code fences, no explanation outside the JSON.
${largeNoticeInstruction}
The JSON must have this exact structure:
{
  "title": "Short descriptive English title for the notice (max 120 chars)",
  "category": "One of: ${NOTICE_CATEGORIES.join(", ")}",
  "audience": ["Array of who this notice is for. Pick from: ${AUDIENCE_OPTIONS.join(", ")}. Include ALL that apply."],
  "summary": "2-4 sentence English summary of the key information. Include what action students need to take, if any.${isLargeNotice ? " Mention that the full student list is available in the original PDF." : ""}",
  "english_translation": "Complete, accurate English translation of the provided notice text. Preserve formatting with newlines. Include all dates, names, and details.",
  "important_dates": ["Array of important dates, format: 'YYYY-MM-DD: Description'. Assume current year 2026 if not specified. Empty array if none."],
  "calendar_events": [{"title": "Event title", "date": "YYYY-MM-DD", "description": "Brief description for calendar entry"}],
  "whatsapp_message": "A fully formatted ready-to-send WhatsApp message using the template below."
}

Rules for whatsapp_message — use this EXACT template:

📢 *MMMUT NOTICE UPDATE*

🎯 *Audience:* _[comma-separated audience]_

📌 *Notice:* *[Title]*

📝 *Summary:*
[Summary text]

📖 *Full Notice (Translated):*
_[Complete english translation text here]_

📅 *Important Dates:*
• [date 1]
• [date 2]

[CALENDAR_LINKS]

🔗 *Read Full Notice:*
[NOTICE_LINK]

Rules for calendar_events:
- Extract EVERY actionable deadline (registration, fee payment, exam, submission)
- Each event needs: title, date (YYYY-MM-DD), description
- Do NOT create calendar events for general announcements with no specific deadline
- If no dates found, return empty array

Rules:
- Translation must be COMPLETE — do not skip any part of the notice.
- If specific branches (CSE, ECE, ME) are mentioned, include them in audience.
- If specific years (1st year, 2nd year) are mentioned, include "B.Tech Xth Year".
- If general, use "All Students".
- Pick the MOST specific category.
- Convert Hindi date formats to YYYY-MM-DD.
- The summary should highlight the MOST important actionable information.
- If no important dates, omit that section from whatsapp_message.
- Leave [NOTICE_LINK] as a placeholder — it will be replaced later.`;
}

// ─── Text Processing (Good OCR) ──────────────────────────────────────

export async function processNoticeFromText(
  ocrText: string,
  options: {
    isLargeNotice?: boolean;
    pageCount?: number;
    pdfUrl?: string;
  } = {}
): Promise<ProcessedNotice> {
  const { isLargeNotice = false, pageCount = 1, pdfUrl } = options;
  const ai = getGeminiClient();

  const userPrompt = `Analyze the following Hindi university notice text extracted via OCR. Some characters may be garbled — use context to infer the correct meaning.
${isLargeNotice ? "\n⚠️ This is a LARGE NOTICE — only the first page is provided. The full notice has " + pageCount + " pages.\n" : ""}
--- NOTICE TEXT START ---
${ocrText}
--- NOTICE TEXT END ---

Respond with the JSON structure as instructed.`;

  let raw = "";
  let method: ProcessedNotice["processing_method"] = "gemini_text";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: userPrompt }],
      config: {
        systemInstruction: buildSystemPrompt(isLargeNotice),
        temperature: 0.2,
      },
    });
    raw = response.text ?? "";
  } catch (error) {
    console.warn(
      "⚠️ Gemini Text API failed, falling back to Groq...",
      error instanceof Error ? error.message : error
    );
    method = "groq_text";
    raw = await callGroqText(
      buildSystemPrompt(isLargeNotice),
      userPrompt
    );
  }

  const parsed = parseAIResponse(raw);

  return {
    ...parsed,
    is_large_notice: isLargeNotice,
    page_count: pageCount,
    processing_method: method,
    original_hindi_text: ocrText,
    whatsapp_message: enrichWhatsAppMessage(
      parsed.whatsapp_message,
      parsed.calendar_events,
      pdfUrl,
      isLargeNotice
    ),
  };
}

// ─── Vision Processing (Bad OCR → send raw PDF) ──────────────────────

export async function processNoticeFromVision(
  pdfBuffer: Buffer,
  options: {
    imageBase64?: string;
    isLargeNotice?: boolean;
    pageCount?: number;
    pdfUrl?: string;
  } = {}
): Promise<ProcessedNotice> {
  const {
    imageBase64,
    isLargeNotice = false,
    pageCount = 1,
    pdfUrl,
  } = options;
  const ai = getGeminiClient();

  // Always parse with pdf-lib to get actual page count and slice to first page if needed
  let finalPdfBuffer = pdfBuffer;
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const actualPageCount = pdfDoc.getPageCount();
    
    if (actualPageCount > 1) {
      const newPdf = await PDFDocument.create();
      const [firstPage] = await newPdf.copyPages(pdfDoc, [0]);
      newPdf.addPage(firstPage);
      finalPdfBuffer = Buffer.from(await newPdf.save());
      console.log(`Sliced PDF from ${actualPageCount} pages to 1 page for Gemini Vision.`);
    }
  } catch (err) {
    console.error("Failed to slice PDF with pdf-lib, falling back to full PDF:", err);
  }

  const base64Pdf = finalPdfBuffer.toString("base64");

  const userPrompt = `This is a scanned Hindi university notice document. Read the entire document using your vision capabilities, then analyze it and respond with the JSON structure as instructed.
${isLargeNotice ? "\n⚠️ This is a LARGE NOTICE — only the first page is provided. The full notice has " + pageCount + " pages.\n" : ""}`;

  let raw = "";
  let method: ProcessedNotice["processing_method"] = "gemini_vision";

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
        systemInstruction: buildSystemPrompt(isLargeNotice),
        temperature: 0.2,
      },
    });
    raw = response.text ?? "";
  } catch (error) {
    console.warn(
      "⚠️ Gemini Vision API failed, falling back to Groq Vision...",
      error instanceof Error ? error.message : error
    );
    method = "groq_vision";

    if (!imageBase64) {
      console.log("Gemini Vision failed and OCR image missing. Converting PDF to image for Groq fallback...");
      try {
        imageBase64 = await convertPdfToImageBase64(pdfBuffer);
      } catch (err) {
        throw new Error(
          "Gemini Vision failed, and fallback PDF-to-Image conversion for Groq also failed: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    raw = await callGroqVision(
      buildSystemPrompt(isLargeNotice),
      userPrompt,
      imageBase64
    );
  }

  const parsed = parseAIResponse(raw);

  return {
    ...parsed,
    is_large_notice: isLargeNotice,
    page_count: pageCount,
    processing_method: method,
    whatsapp_message: enrichWhatsAppMessage(
      parsed.whatsapp_message,
      parsed.calendar_events,
      pdfUrl,
      isLargeNotice
    ),
  };
}

// ─── Groq Fallback — Text ────────────────────────────────────────────

async function callGroqText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini failed and GROQ_API_KEY is not configured. " +
        "Set GROQ_API_KEY in your environment variables."
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq Text API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Groq returned empty response");
  }

  return data.choices[0].message.content;
}

// ─── Groq Fallback — Vision ─────────────────────────────────────────

async function callGroqVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini failed and GROQ_API_KEY is not configured. " +
        "Set GROQ_API_KEY in your environment variables."
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Groq Vision API error (${response.status}): ${errText}`
    );
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Groq Vision returned empty response");
  }

  return data.choices[0].message.content;
}

// ─── Response Parser ─────────────────────────────────────────────────

interface ParsedResponse {
  title: string;
  category: string;
  audience: string[];
  summary: string;
  english_translation: string;
  important_dates: string[];
  calendar_events: CalendarEvent[];
  whatsapp_message: string;
}

function parseAIResponse(raw: string): ParsedResponse {
  // Strip markdown code fences if AI wraps the JSON
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    const data = JSON.parse(cleaned);

    // Parse calendar events with URL generation
    const calendarEvents: CalendarEvent[] = [];
    if (Array.isArray(data.calendar_events)) {
      for (const event of data.calendar_events) {
        if (event.title && event.date) {
          const calEvent: CalendarEvent = {
            title: String(event.title),
            date: String(event.date),
            description: String(event.description || ""),
            calendar_url: generateCalendarUrl({
              title: String(event.title),
              date: String(event.date),
              description: String(
                event.description || ""
              ),
            }),
          };
          calendarEvents.push(calEvent);
        }
      }
    }

    return {
      title: String(data.title || "Untitled Notice").substring(
        0,
        200
      ),
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
      important_dates: Array.isArray(data.important_dates)
        ? data.important_dates.map(String)
        : [],
      calendar_events: calendarEvents,
      whatsapp_message: String(data.whatsapp_message || ""),
    };
  } catch {
    // If JSON parsing fails, return a fallback
    console.error(
      "Failed to parse AI response as JSON:",
      cleaned.substring(0, 500)
    );

    return {
      title: "Notice (Parse Error)",
      category: "Other",
      audience: ["All Students"],
      summary:
        "The AI response could not be parsed. The raw output is included in the translation field.",
      english_translation: raw,
      important_dates: [],
      calendar_events: [],
      whatsapp_message: "",
    };
  }
}

// ─── WhatsApp Message Enrichment ─────────────────────────────────────

/**
 * Post-process the WhatsApp message:
 *   1. Add Google Calendar links for each deadline event
 *   2. Add PDF link for large notices
 *   3. Replace [NOTICE_LINK] placeholder if pdfUrl is provided
 */
function enrichWhatsAppMessage(
  message: string,
  calendarEvents: CalendarEvent[],
  pdfUrl?: string,
  isLargeNotice: boolean = false
): string {
  let enriched = message;

  // Replace calendar links placeholder
  if (enriched.includes("[CALENDAR_LINKS]")) {
    if (calendarEvents.length > 0) {
      const calSection = calendarEvents
        .map((e) => `• *${e.title}* (${e.date})\n  🗓️ ${e.calendar_url}`)
        .join("\n\n");
      enriched = enriched.replace("[CALENDAR_LINKS]", `📅 *Add to Calendar:*\n${calSection}`);
    } else {
      enriched = enriched.replace("[CALENDAR_LINKS]", ""); // Remove if no events
    }
  }

  // Add PDF link for large notices
  if (isLargeNotice && pdfUrl) {
    if (!enriched.includes("View full list")) {
      enriched += `\n\n📄 View full student list:\n${pdfUrl}`;
    }
  }

  // Replace notice link placeholder
  if (pdfUrl && enriched.includes("[NOTICE_LINK]")) {
    enriched = enriched.replace("[NOTICE_LINK]", pdfUrl);
  }

  return enriched;
}
