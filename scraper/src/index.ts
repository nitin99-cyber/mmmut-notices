/**
 * @module index
 * Main entry point for the MMMUT Notice Scraper.
 *
 * Workflow:
 * 1. Fetch the AllRecord HTML page
 * 2. Parse notice metadata (titles, PDF URLs, dates)
 * 3. For each notice, check for duplicates by URL (fast, no download)
 * 4. Download the PDF and check for duplicates by content hash
 * 5. Insert new notices into `scraped_notices` and create processing jobs
 * 6. Log execution summary to `system_logs`
 */

import { SCRAPE_URL, MAX_NOTICES_PER_RUN, DRY_RUN } from './config.js';
import { supabase } from './supabase.js';
import { parseNoticePage } from './parser.js';
import { checkDuplicate } from './duplicate.js';
import { downloadPdf } from './downloader.js';
import { computeHash } from './hash.js';
import { createProcessingJob, markJobCompleted } from './queue.js';
import { logExecution, type ScraperResult } from './logger.js';
import { triggerAIPipeline } from './pipeline.js';
import { logExecution, type ScraperResult } from './logger.js';

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('🔍 MMMUT Notice Scraper starting...');
  if (DRY_RUN) {
    console.log('🧪 DRY RUN mode — no database writes or PDF downloads');
  }

  // ─── Step 1: Fetch the notices page ────────────────────────────────
  console.log(`📡 Fetching ${SCRAPE_URL}...`);

  const response = await fetch(SCRAPE_URL, {
    headers: {
      'User-Agent':
        'MMMUT-Notice-Scraper/1.0 (https://github.com/mmmut-notices)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch notices page: HTTP ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  console.log(`📄 Received ${(html.length / 1024).toFixed(1)} KB of HTML`);

  // ─── Step 2: Parse notices ─────────────────────────────────────────
  const notices = parseNoticePage(html);
  console.log(`📋 Found ${notices.length} notices on page`);

  if (notices.length === 0) {
    console.warn('⚠️  No notices found — page structure may have changed');
  }

  // Limit per run to stay within rate limits
  const toProcess = notices.slice(0, MAX_NOTICES_PER_RUN);
  if (toProcess.length < notices.length) {
    console.log(
      `📏 Processing first ${toProcess.length} of ${notices.length} (MAX_NOTICES_PER_RUN=${MAX_NOTICES_PER_RUN})`
    );
  }

  let newCount = 0;
  let dupCount = 0;
  let failCount = 0;

  // ─── Step 3–5: Process each notice ─────────────────────────────────
  for (const notice of toProcess) {
    try {
      // Fast duplicate check by URL (no download needed)
      const urlCheck = await checkDuplicate(notice.pdf_url, null);
      if (urlCheck.isDuplicate) {
        dupCount++;
        continue;
      }

      // In dry-run mode, stop here — don't download or write
      if (DRY_RUN) {
        console.log(`[DRY RUN] 🆕 New notice: ${notice.title}`);
        newCount++;
        continue;
      }

      // Download PDF
      let pdfBuffer: Buffer;
      let hash = "";
      
      try {
        pdfBuffer = await downloadPdf(notice.pdf_url);
        hash = computeHash(pdfBuffer);
      } catch (dlError) {
        if (dlError instanceof Error && dlError.message.includes('404')) {
          console.warn(`☠️ Dead link detected (404). Marking to ignore in future runs: ${notice.title}`);
          await supabase
            .from('scraped_notices')
            .insert({
              title: notice.title,
              pdf_url: notice.pdf_url,
              source_url: notice.source_url,
              publish_date: notice.publish_date || null,
              pdf_hash: `dead_404_${Date.now()}_${Math.random()}`,
              status: 'dead_link',
            });
          failCount++;
          continue;
        }
        throw dlError; // Throw other network errors to be caught by the main catch block
      }

      // Content-hash duplicate check (catches re-uploads at new URLs)
      const hashCheck = await checkDuplicate(notice.pdf_url, hash);
      if (hashCheck.isDuplicate) {
        console.log(`🔁 Duplicate by ${hashCheck.reason}: ${notice.title}`);
        dupCount++;
        continue;
      }

      // Insert into scraped_notices
      const { data, error } = await supabase
        .from('scraped_notices')
        .insert({
          title: notice.title,
          pdf_url: notice.pdf_url,
          source_url: notice.source_url,
          publish_date: notice.publish_date || null,
          pdf_hash: hash,
          status: 'new',
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Insert failed: ${error.message}`);
      }

      // Create processing job as a safety net
      const jobId = await createProcessingJob(data.id, notice.pdf_url);

      newCount++;
      console.log(`✅ New notice saved to DB: ${notice.title}`);

      // Automatically trigger the AI Pipeline
      const pipelineSuccess = await triggerAIPipeline(pdfBuffer, notice.pdf_url, notice.title);
      
      if (pipelineSuccess) {
        // If the automated pipeline succeeded, mark the job as completed so it doesn't show as pending
        await markJobCompleted(jobId);
      }
      
    } catch (err) {
      failCount++;
      console.error(
        `❌ Failed: ${notice.title}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Step 6: Log execution summary ─────────────────────────────────
  const result: ScraperResult = {
    total_found: notices.length,
    new_notices: newCount,
    duplicates: dupCount,
    failures: failCount,
    duration_ms: Date.now() - startTime,
  };

  await logExecution(result);
  console.log('🏁 Scraper finished:', result);
}

// Run and exit with appropriate code
main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
