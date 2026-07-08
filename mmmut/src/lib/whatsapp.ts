/**
 * WhatsApp Message Formatter
 *
 * Generates formatted WhatsApp-ready messages from processed notices.
 * Handles both normal and large notices (student lists).
 *
 * Message format:
 *   📢 MMMUT NOTICE UPDATE
 *   🎯 Audience: ...
 *   📌 Notice: ...
 *   📝 Summary: ...
 *   📅 Important Dates: ...
 *   🗓️ Add to Calendar: ... (with Google Calendar links)
 *   📄 View full list: ... (for large notices)
 *   🔗 Original Notice: ...
 */

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

/**
 * Generate a formatted WhatsApp message from a processed notice.
 *
 * @param input - Processed notice data
 * @returns Formatted WhatsApp message string ready to copy-paste
 */
export async function formatWhatsAppMessage(
  input: WhatsAppMessageInput
): Promise<string> {
  const sections: string[] = [];

  // Header
  sections.push("📢 *MMMUT NOTICE UPDATE*");

  // Audience
  sections.push(
    `🎯 *Audience:* ${input.audience.join(", ")}`
  );

  // Title
  sections.push(`📌 *Notice:* ${input.title}`);

  // Summary
  sections.push(`📝 *Summary:*\n${input.summary}`);

  // Important Dates (only if present)
  if (input.important_dates.length > 0) {
    const dateLines = input.important_dates
      .map((d) => `• ${d}`)
      .join("\n");
    sections.push(`📅 *Important Dates:*\n${dateLines}`);
  }

  // Calendar Links (only if present)
  if (input.calendar_events.length > 0) {
    sections.push(
      await formatCalendarForWhatsApp(input.calendar_events)
    );
  }

  // Complete Translation
  sections.push(`📝 *Complete Translation:*\n_${input.english_translation}_`);

  // Large notice — PDF link for full student list
  if (input.is_large_notice && input.pdf_url) {
    sections.push(
      `📄 *View Full List (PDF):*\n${input.pdf_url}`
    );
  }

  // Original notice link
  if (input.pdf_url) {
    sections.push(
      `🔗 *Original Notice:*\n${input.pdf_url}`
    );
  }

  // Footer
  sections.push("━━━━━━━━━━━━━━━━━\n_MMMUT Notice Intelligence_");

  return sections.join("\n\n");
}
