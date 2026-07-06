/**
 * Calendar Event Utility
 *
 * Generates Google Calendar "Add to Calendar" URLs from extracted
 * notice dates. These URLs are included in WhatsApp messages so
 * students can tap to add deadlines directly to their calendar.
 *
 * Future: Android app will use the calendar_events array to display
 * deadlines with native calendar integration.
 */

export interface CalendarEvent {
  /** Event title, e.g. "Registration Deadline" */
  title: string;

  /** Event date in YYYY-MM-DD format */
  date: string;

  /** Brief description for the calendar entry */
  description?: string;

  /** Generated Google Calendar URL (populated after processing) */
  calendar_url?: string;
}

/**
 * Generate a Google Calendar "Add to Calendar" URL.
 *
 * When a student clicks this link on their phone:
 *   - Android: Opens Google Calendar with pre-filled event
 *   - iOS: Opens calendar app or Google Calendar
 *   - Desktop: Opens Google Calendar in browser
 *
 * @param event - Calendar event data
 * @returns Google Calendar URL string
 *
 * @example
 * generateCalendarUrl({
 *   title: "Hostel Fee Submission",
 *   date: "2026-07-20",
 *   description: "Last date to submit hostel fee for session 2026-27"
 * })
 * // Returns: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...
 */
export function generateCalendarUrl(
  event: Omit<CalendarEvent, "calendar_url">
): string {
  const { title, date, description } = event;

  // Google Calendar expects dates in YYYYMMDD format for all-day events
  const formattedDate = date.replace(/-/g, "");

  // For all-day events, end date is the next day
  const endDate = getNextDay(date).replace(/-/g, "");

  // Build the Google Calendar URL
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `MMMUT: ${title}`,
    dates: `${formattedDate}/${endDate}`,
    details: description
      ? `${description}\n\nSource: MMMUT Notice Intelligence Platform`
      : "Source: MMMUT Notice Intelligence Platform",
    location: "MMMUT, Gorakhpur",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate calendar URLs for all events in a notice.
 *
 * @param events - Array of calendar events from AI processing
 * @returns Same events with calendar_url populated
 */
export function enrichCalendarEvents(
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.map((event) => ({
    ...event,
    calendar_url: generateCalendarUrl(event),
  }));
}

/**
 * Format calendar events for WhatsApp message inclusion.
 *
 * @param events - Array of calendar events with URLs
 * @returns Formatted string for WhatsApp message
 *
 * @example
 * formatCalendarForWhatsApp(events)
 * // Returns:
 * // 🗓️ Add to Calendar:
 * // • Registration Deadline (2026-07-20)
 * //   📅 https://calendar.google.com/calendar/render?...
 */
export function formatCalendarForWhatsApp(
  events: CalendarEvent[]
): string {
  if (events.length === 0) return "";

  const lines = events
    .map(
      (e) =>
        `• ${e.title} (${formatDateHuman(e.date)})\n  📅 ${e.calendar_url || generateCalendarUrl(e)}`
    )
    .join("\n");

  return `🗓️ Add to Calendar:\n${lines}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Get the next day in YYYY-MM-DD format (for all-day calendar events).
 */
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split("T")[0];
}

/**
 * Format a date string like "2026-07-20" to "20 Jul 2026".
 */
function formatDateHuman(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}
