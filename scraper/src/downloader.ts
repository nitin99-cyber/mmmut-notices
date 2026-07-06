/**
 * @module downloader
 * PDF downloader with retry logic for fetching notice documents from MMMUT.
 */

/** Maximum number of fetch attempts before giving up */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 2_000;

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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'MMMUT-Notice-Scraper/1.0 (https://github.com/mmmut-notices)',
          Accept: 'application/pdf,*/*',
        },
        signal: AbortSignal.timeout(30_000), // 30s timeout per attempt
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText} for ${url}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error(`Empty response body for ${url}`);
      }

      return buffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `⚠️  Download attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${lastError.message}`
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
