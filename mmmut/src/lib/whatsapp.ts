import { formatCalendarForWhatsApp, type CalendarEvent } from "./calendar";

export interface WhatsAppMessageInput {
  title: string;
  summary: string;
  english_translation: string;
  audience: string[];
  important_dates: string[];
  calendar_events: CalendarEvent[];
  pdf_url?: string;
  is_large_notice: boolean;
  notice_link?: string;
}

/** Remove roll-list/student-table rows from large notices before distribution. */
export function removeStudentTable(text: string, isLargeNotice: boolean): string {
  if (!text) return text;

  const lines = text.split(/\r?\n/);
  // Match common table headers like "S.N.", "FORM NUMBER", "Enrollment No.", "Roll No.", "Name", "Father Name"
  const headerPattern = /(?:s\.?n\.?|form\s*(?:no|number)|enrol(?:l)?ment|roll\s*no|father\s*name|student\s*name|t\/p\s*batch)/i;
  
  // Find the first line that looks like a table header
  const headerIndex = lines.findIndex((line) => headerPattern.test(line) && /roll|name|enrol|form/i.test(line));

  if (headerIndex < 0) return text;

  // Let's assume everything from the header onwards is the table, 
  // or until we hit a block of non-table text.
  // For simplicity, we just strip everything from header index onwards 
  // if we detect at least a few row-like lines.
  const rowPattern = /^\s*\d+\s+[A-Z0-9]/i;
  const rowsAfterHeader = lines.slice(headerIndex + 1).filter((line) => rowPattern.test(line) || /^[A-Z0-9]{5,}/.test(line)).length;
  
  if (rowsAfterHeader < 3 && !isLargeNotice) return text;

  return [
    ...lines.slice(0, headerIndex).map((line) => line.trimEnd()),
    "\n*[Student records and tabular data have been intentionally omitted for readability. Please refer to the original official PDF for the complete list.]*",
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface OpenWAConfig {
  baseUrl: string;
  apiKey?: string;
  sessionId: string;
  channelJid: string;
}

export interface ParseValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether a notice was successfully parsed by the AI pipeline.
 * Ensures faulty, malformed, or fallback-error notices are NEVER broadcasted.
 */
export function isNoticeSuccessfullyParsed(notice: any): ParseValidationResult {
  if (!notice) {
    return { valid: false, reason: "Notice object is null or undefined" };
  }

  const title = (notice.title || "").trim();
  const summary = (notice.summary || "").trim();
  const translation = (notice.english_translation || "").trim();
  const whatsappMessage = (notice.whatsapp_message || "").trim();

  // 1. Check title
  if (!title || title.length < 5) {
    return { valid: false, reason: "Notice title is missing or too short" };
  }
  if (
    title.toLowerCase().includes("parse error") ||
    title.toLowerCase().includes("error processing") ||
    title.toLowerCase() === "untitled notice"
  ) {
    return { valid: false, reason: `Notice title indicates a processing error: "${title}"` };
  }

  // 2. Check summary
  if (!summary || summary.length < 10) {
    return { valid: false, reason: "Notice summary is missing or too short" };
  }
  if (
    summary.toLowerCase().includes("could not be parsed") ||
    summary.toLowerCase().includes("no summary available")
  ) {
    return { valid: false, reason: "Notice summary indicates parsing failure" };
  }

  // 3. Check translation
  if (!translation || translation.length < 10) {
    return { valid: false, reason: "Notice translation is missing or too short" };
  }

  // 4. Check whatsapp_message
  if (!whatsappMessage) {
    return { valid: false, reason: "WhatsApp message has not been generated" };
  }
  if (
    whatsappMessage.toLowerCase().includes("error processing notice") ||
    whatsappMessage.toLowerCase().includes("pipeline failed")
  ) {
    return { valid: false, reason: "WhatsApp message indicates an error" };
  }

  return { valid: true };
}

/**
 * Generate a formatted WhatsApp message from a processed notice.
 *
 * @param input - Processed notice data
 * @returns Formatted WhatsApp message string ready to copy-paste or broadcast
 */
export async function formatWhatsAppMessage(
  input: WhatsAppMessageInput
): Promise<string> {
  const sections: string[] = [];

  // Header
  sections.push("🚨 *MMMUT OFFICIAL NOTICE* 🚨");
  sections.push("━━━━━━━━━━━━━━━━━━━━━");

  // Title
  sections.push(`📌 *Subject:* ${input.title}`);

  // Audience
  if (input.audience && input.audience.length > 0) {
    sections.push(`🎯 *For:* ${input.audience.join(", ")}`);
  }

  // Summary
  sections.push(`\n📝 *Key Highlights:*\n${input.summary}`);

  // Important Dates (only if present)
  if (input.important_dates && input.important_dates.length > 0) {
    const dateLines = input.important_dates
      .map((d) => `⏳ ${d}`)
      .join("\n");
    sections.push(`\n📅 *Deadlines & Dates:*\n${dateLines}`);
  }

  // Calendar Links (only if present)
  if (input.calendar_events && input.calendar_events.length > 0) {
    sections.push(
      await formatCalendarForWhatsApp(input.calendar_events)
    );
  }

  // Translation / Details
  if (input.english_translation && !input.is_large_notice) {
    sections.push(`\n📖 *Detailed Notice:*\n${input.english_translation}`);
  } else if (input.is_large_notice) {
    sections.push("\n📋 *Full list:* Student records are intentionally omitted from this message. Open the original PDF for the complete list.");
  }

  // Original notice link
  if (input.pdf_url) {
    sections.push(`\n🔗 *Download Official PDF:*\n${input.pdf_url}`);
  }

  // Footer
  sections.push("\n━━━━━━━━━━━━━━━━━━━━━\n🤖 _Powered by MMMUT Notice Intelligence_");

  return sections.join("\n");
}

/**
 * Retrieves the OpenWA configuration from environment variables.
 */
export function getOpenWAConfig(): OpenWAConfig | null {
  const baseUrl = (process.env.OPENWA_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.OPENWA_API_KEY || "").trim();
  const sessionId = (process.env.OPENWA_SESSION_ID || "default").trim();
  const channelJid = (process.env.OPENWA_CHANNEL_JID || "").trim();

  if (!baseUrl || !channelJid) {
    return null;
  }

  return {
    baseUrl,
    apiKey: apiKey || undefined,
    sessionId,
    channelJid,
  };
}

/**
 * Sends a raw text message to WhatsApp via OpenWA REST API.
 * Supports sending to WhatsApp Channels (@newsletter), Groups (@g.us), and Users (@c.us).
 */
export async function sendWhatsAppText(
  text: string,
  targetChatId?: string
): Promise<{ success: boolean; messageId?: string; error?: string; details?: any }> {
  const config = getOpenWAConfig();
  if (!config) {
    return {
      success: false,
      error: "OpenWA is not configured. Set OPENWA_BASE_URL and OPENWA_CHANNEL_JID in .env",
    };
  }

  const chatId = targetChatId || config.channelJid;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  // OpenWA supports both /api/sessions/{sessionId}/messages/send-text and /api/v1/messages/send
  const candidateUrls = [
    `${config.baseUrl}/api/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`,
    `${config.baseUrl}/api/v1/messages/send`,
    `${config.baseUrl}/api/messages/send-text`,
  ];

  let lastError: string = "No response from OpenWA gateway";

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chatId,
          text,
          message: text,
        }),
      });

      if (response.ok) {
        const json = await response.json().catch(() => ({}));
        console.log(`✅ [OpenWA] Message dispatched successfully to ${chatId}`);
        return {
          success: true,
          messageId: json.id || json.messageId || json.data?.id,
          details: json,
        };
      }

      if (response.status === 404) {
        // Try next candidate endpoint URL
        continue;
      }

      const errorBody = await response.text();
      lastError = `OpenWA HTTP ${response.status}: ${errorBody}`;
      break;
    } catch (err: any) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  console.error(`❌ [OpenWA] Failed to send message to ${chatId}:`, lastError);
  return {
    success: false,
    error: lastError,
  };
}

/**
 * High-level function to publish a notice to the WhatsApp channel.
 * STRICTLY checks that the notice was successfully parsed before sending!
 */
export async function publishNoticeToWhatsAppChannel(
  notice: any,
  options?: { force?: boolean }
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // 1. Strict parsing validation
  if (!options?.force) {
    const validation = isNoticeSuccessfullyParsed(notice);
    if (!validation.valid) {
      console.warn(`⛔ [OpenWA] Skipping WhatsApp broadcast — notice failed parsing check: ${validation.reason}`);
      return {
        success: false,
        error: `Notice not successfully parsed: ${validation.reason}`,
      };
    }
  }

  const message = notice.whatsapp_message || (await formatWhatsAppMessage({
    title: notice.title,
    summary: notice.summary,
    english_translation: notice.english_translation,
    audience: Array.isArray(notice.audience) ? notice.audience : [notice.audience],
    important_dates: Array.isArray(notice.important_dates) ? notice.important_dates : [],
    calendar_events: notice.calendar_events || [],
    pdf_url: notice.pdf_url,
    is_large_notice: !!notice.is_large_notice,
  }));

  console.log(`🚀 [OpenWA] Broadcasting successfully parsed notice to WhatsApp Channel: "${notice.title}"`);
  return await sendWhatsAppText(message);
}

