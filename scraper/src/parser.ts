/**
 * @module parser
 * HTML parser for the MMMUT AllRecord notices page.
 * Uses cheerio to extract notice metadata from the page markup.
 */

import * as cheerio from 'cheerio';
import { SCRAPE_URL } from './config.js';

/** Metadata extracted from a single notice entry on the page */
export interface NoticeMetadata {
  /** Human-readable notice title */
  title: string;
  /** Absolute URL to the notice PDF */
  pdf_url: string;
  /** Date string as it appears on the page (best-effort parse) */
  publish_date: string;
  /** The page URL this notice was scraped from */
  source_url: string;
}

/** Base URL for resolving relative paths */
const BASE_URL = 'https://www.mmmut.ac.in';

/**
 * Resolves a possibly-relative URL to an absolute one.
 * Handles hrefs like `/Aborting/filename.pdf`, `//domain/path`, and already-absolute URLs.
 */
function makeAbsoluteUrl(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return `${BASE_URL}${trimmed}`;
  }
  return `${BASE_URL}/${trimmed}`;
}

/**
 * Attempts to extract a date string from surrounding text.
 * Looks for common date patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY,
 * "Month DD, YYYY", etc.
 *
 * @returns The first date-like substring found, or empty string.
 */
function extractDate(text: string): string {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numericMatch = text.match(
    /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/
  );
  if (numericMatch) return numericMatch[1];

  // "Month DD, YYYY" or "DD Month YYYY"
  const namedMatch = text.match(
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4})/i
  );
  if (namedMatch) return namedMatch[1];

  const namedMatch2 = text.match(
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[\s,]+\d{2,4})/i
  );
  if (namedMatch2) return namedMatch2[1];

  return '';
}

/**
 * Parse the MMMUT AllRecord page HTML and extract notice metadata.
 *
 * The parser is intentionally defensive — it tries multiple strategies
 * to locate notices and silently skips entries it cannot parse, logging
 * warnings instead of throwing.
 *
 * @param html - Raw HTML string of the AllRecord page
 * @returns Array of parsed notice metadata objects
 */
export function parseNoticePage(html: string): NoticeMetadata[] {
  const $ = cheerio.load(html);
  const notices: NoticeMetadata[] = [];
  const seenUrls = new Set<string>();

  // Strategy 1: Find all anchor tags specifically inside the main announcements grid or the news marquee
  $('#ContentPlaceHolder2_GridView1 a[href], marquee a[href]').each((_index, element) => {
    try {
      const el = $(element);
      const href = el.attr('href') ?? '';

      // Only process PDF links
      if (!href.match(/\.pdf\s*$/i)) return;

      const pdfUrl = makeAbsoluteUrl(href);

      // Deduplicate within this page parse
      if (seenUrls.has(pdfUrl)) return;
      seenUrls.add(pdfUrl);

      // --- Title extraction ---
      // Priority: link text → title attr → alt attr → parent text → filename
      let title = el.text().trim();

      if (!title) {
        title = el.attr('title')?.trim() ?? '';
      }
      if (!title) {
        title = el.find('img').attr('alt')?.trim() ?? '';
      }
      if (!title) {
        // Walk up to the parent row / container and grab its text
        const parentText = el.closest('tr, li, div, p').text().trim();
        // Remove excessively long parent text (probably the whole section)
        if (parentText && parentText.length < 500) {
          title = parentText;
        }
      }
      if (!title) {
        // Fallback: derive from filename
        const segments = pdfUrl.split('/');
        title = decodeURIComponent(segments[segments.length - 1] ?? 'Untitled')
          .replace(/\.pdf$/i, '')
          .replace(/[_-]+/g, ' ');
      }

      // Clean up excessive whitespace
      title = title.replace(/\s+/g, ' ').trim();

      // --- Filter logic ---
      // Skip notices meant for staff/professors or office orders
      if (/(office\s*order|professor|faculty|staff)/i.test(title)) {
        console.log(`⏭️  Skipping notice (filtered title): ${title}`);
        return;
      }

      // --- Date extraction ---
      // Look in the parent row / container for a date
      const parentContainer = el.closest('tr, li, div.notice, div.row');
      const containerText = parentContainer.length
        ? parentContainer.text()
        : el.parent().text();
      const publishDate = extractDate(containerText);

      notices.push({
        title,
        pdf_url: pdfUrl,
        publish_date: publishDate,
        source_url: SCRAPE_URL,
      });
    } catch (err) {
      console.warn(`⚠️  Warning: Failed to parse a notice entry, skipping.`, err);
    }
  });

  if (notices.length === 0) {
    console.warn(
      '⚠️  Warning: No notices found on page. The HTML structure may have changed.'
    );
  }

  return notices;
}
