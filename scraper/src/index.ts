/**
 * @module index
 * Main entry point for the MMMUT Notice Scraper.
 *
 * Workflow:
 * 1. Fetch the AllRecord HTML page
 * 2. Parse notice metadata (titles, PDF URLs, dates)
 * 3. For each notice, check for duplicates by URL (fast, no download)
 *    → If URL exists but was NEVER processed (status new/pending/failed),
 *      re-trigger the AI pipeline automatically (self-healing).
 * 4. Download the PDF and check for duplicates by content hash
 * 5. Insert new notices into `scraped_notices` and create processing jobs
 * 6. Log execution summary to `system_logs`
 */

import {
  SCRAPE_URLS,
  MAX_NOTICES_PER_RUN,
  DRY_RUN,
  STEALTH_HEADERS,
} from './config.js';
import { supabase } from './supabase.js';
import { parseNoticePage } from './parser.js';
import { checkDuplicate } from './duplicate.js';
import { downloadPdf } from './downloader.js';
import { computeHash } from './hash.js';
import { createProcessingJob, markJobCompleted } from './queue.js';
import { logExecution, type ScraperResult } from './logger.js';
import { triggerAIPipeline } from './pipeline.js';

/** Statuses that mean the notice was scraped but never AI-processed */
const UNPROCESSED_STATUSES = new Set(['new', 'pending', 'failed']);

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('🔍 MMMUT Notice Scraper starting...');
  if (DRY_RUN) {
    console.log('🧪 DRY RUN mode — no database writes or PDF downloads');
  }

  // ─── Step 1 & 2: Fetch and parse notices from all URLs ─────────────
  let notices: any[] = [];
  
  for (const url of SCRAPE_URLS) {
    console.log(`\n📡 Fetching ${url}...`);

    try {
      const response = await fetch(url, {
        headers: {
          ...STEALTH_HEADERS,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
        continue;
      }

      const html = await response.text();
      console.log(`📄 Received ${(html.length / 1024).toFixed(1)} KB of HTML from ${url}`);

      const pageNotices = parseNoticePage(html, url);
      console.log(`📋 Found ${pageNotices.length} notices on this page`);
      
      notices.push(...pageNotices);
    } catch (err) {
      console.error(`❌ Error fetching ${url}:`, err);
    }
  }

  if (notices.length === 0) {
    console.warn('\n⚠️  No notices found across any of the URLs — page structures may have changed');
    return;
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
  let reprocessedCount = 0;

  // ─── Step 3–5: Process each notice ─────────────────────────────────
  for (const notice of toProcess) {
    try {
      if (notice.pdf_url.includes('ExaminationSchedule')) {
        console.log(`🚫 Skipping blocked URL: ${notice.pdf_url}`);
        continue;
      }

      // Fast duplicate check by URL (no download needed)
      const urlCheck = await checkDuplicate(notice.pdf_url, null);

      if (urlCheck.isDuplicate && urlCheck.reason === 'url_match') {
        const { existingRecord } = urlCheck;

        // ── Self-healing: if it was never AI-processed, re-trigger pipeline ──
        if (
          existingRecord &&
          UNPROCESSED_STATUSES.has(existingRecord.status) &&
          !DRY_RUN
        ) {
          console.log(`♻️  Unprocessed notice found (status=${existingRecord.status}), re-triggering pipeline: ${notice.title}`);

          try {
            // Mark as 'processing' to prevent double-runs
            await supabase
              .from('scraped_notices')
              .update({ status: 'processing' })
              .eq('id', existingRecord.id);

            const pdfBuffer = await downloadPdf(notice.pdf_url);
            const pipelineSuccess = await triggerAIPipeline(pdfBuffer, notice.pdf_url, notice.title);

            if (pipelineSuccess) {
              await supabase
                .from('scraped_notices')
                .update({ status: 'processed' })
                .eq('id', existingRecord.id);
              console.log(`   🎉 Pipeline succeeded! Notice processed & email sent.`);
              reprocessedCount++;
              newCount++;
            } else {
              // Reset back to 'failed' so the next run can try again
              await supabase
                .from('scraped_notices')
                .update({ status: 'failed' })
                .eq('id', existingRecord.id);
              console.log(`   ❌ Pipeline failed. Will retry on next run.`);
              failCount++;
            }
          } catch (reprocessErr) {
            // Reset status so it isn't stuck as 'processing'
            await supabase
              .from('scraped_notices')
              .update({ status: 'failed' })
              .eq('id', existingRecord.id);
            console.error(`   ❌ Re-process error: ${reprocessErr instanceof Error ? reprocessErr.message : reprocessErr}`);
            failCount++;
          }
          continue;
        }

        // Truly processed already — skip silently (only log on DRY_RUN for clarity)
        if (DRY_RUN) {
          console.log(`🔁 Duplicate (${existingRecord?.status ?? 'processed'}): ${notice.title}`);
        }
        dupCount++;
        continue;
      }

      // ── Hash duplicate: same content at a different URL ──
      if (urlCheck.isDuplicate && urlCheck.reason === 'hash_match') {
        dupCount++;
        continue;
      }

      // ── In dry-run mode, stop here ──
      if (DRY_RUN) {
        console.log(`[DRY RUN] 🆕 New notice: ${notice.title}`);
        newCount++;
        continue;
      }

      // Add a small random jitter (1–3 s) to disguise bot behavior
      const jitterMs = Math.floor(Math.random() * 2000) + 1000;
      await new Promise((resolve) => setTimeout(resolve, jitterMs));

      // ── Download PDF ──
      let pdfBuffer: Buffer;
      let hash = '';

      try {
        pdfBuffer = await downloadPdf(notice.pdf_url);
        hash = computeHash(pdfBuffer);
      } catch (dlError) {
        if (dlError instanceof Error && dlError.message.includes('404')) {
          console.warn(`☠️ Dead link (404), skipping future scrapes: ${notice.title}`);
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
        throw dlError;
      }

      // ── Content-hash duplicate check ──
      const hashCheck = await checkDuplicate(notice.pdf_url, hash);
      if (hashCheck.isDuplicate) {
        console.log(`🔁 Duplicate by ${hashCheck.reason}: ${notice.title}`);
        dupCount++;
        continue;
      }

      // ── Insert into scraped_notices ──
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

      const jobId = await createProcessingJob(data.id, notice.pdf_url);

      newCount++;
      console.log(`✅ New notice saved: ${notice.title}`);

      // ── Trigger AI Pipeline ──
      const pipelineSuccess = await triggerAIPipeline(pdfBuffer, notice.pdf_url, notice.title);

      if (pipelineSuccess) {
        await markJobCompleted(jobId);
        await supabase
          .from('scraped_notices')
          .update({ status: 'processed' })
          .eq('id', data.id);
        console.log(`🎉 Pipeline complete! Notice processed & email sent.`);
      } else {
        console.log(`⚠️  Pipeline failed. Notice left as 'failed' for next run.`);
        await supabase
          .from('scraped_notices')
          .update({ status: 'failed' })
          .eq('id', data.id);
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

  if (reprocessedCount > 0) {
    console.log(`\n♻️  Re-processed ${reprocessedCount} previously stuck notice(s).`);
  }

  await logExecution(result);
  console.log('\nScraper run complete in ' + (result.duration_ms / 1000).toFixed(1) + 's');
  console.log(`  Found:      ${result.total_found}`);
  console.log(`  New:        ${result.new_notices}`);
  console.log(`  Duplicates: ${result.duplicates}`);
  console.log(`  Failures:   ${result.failures}`);
  console.log('\n🏁 Scraper finished:', result);
}

// Run and exit with appropriate code
main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
