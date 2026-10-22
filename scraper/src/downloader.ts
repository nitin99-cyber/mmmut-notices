/**
 * @module downloader
 * PDF downloader with retry logic for fetching notice documents from MMMUT.
 */

import { STEALTH_HEADERS } from './config.js';

/** Maximum number of fetch attempts before giving up */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 1_500;

/** Keep a single unavailable PDF from blocking the whole scrape indefinitely. */
const DOWNLOAD_TIMEOUT_MS = 20_000;

function alternateUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.mmmut.ac.in') {
      parsed.hostname = 'mmmut.ac.in';
      return parsed.toString();
    }
    if (parsed.hostname === 'mmmut.ac.in') {
      parsed.hostname = 'www.mmmut.ac.in';
      return parsed.toString();
    }
  } catch {
    // The caller will receive the normal fetch error for an invalid URL.
  }
  return undefined;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download a PDF from the given URL and return it as a Buffer.
 *
 * Retries up to {@link MAX_RETRIES} times with a {@link RETRY_DELAY_MS}ms
 * delay between attempts. Throws after all retries are exhausted.
 *
 * @param url - Absolute URL of the PDF to download
 * @returns Buffer containing the raw PDF bytes
 * @throws Error if the download fails after all retries
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  let lastError: Error | undefined;

  const fallbackUrl = alternateUrl(url);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const requestUrl = attempt === 2 && fallbackUrl ? fallbackUrl : url;
    try {
      const response = await fetch(requestUrl, {
        headers: {
          ...STEALTH_HEADERS,
          Accept: 'application/pdf,*/*',
        },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText} for ${requestUrl}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error(`Empty response body for ${url}`);
      }

      // A 200 HTML error page must not enter the PDF/OCR pipeline.
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const isPdf = buffer.subarray(0, 5).toString() === '%PDF-';
      if (!isPdf && !contentType.includes('pdf')) {
        throw new Error(`Response is not a PDF (content-type: ${contentType || 'unknown'})`);
      }

      return buffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `⚠️  Download attempt ${attempt}/${MAX_RETRIES} failed for ${requestUrl}: ${lastError.message}`
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Failed to download PDF after ${MAX_RETRIES} attempts: ${url} — ${lastError?.message}`
  );
}
