/**
 * @module reprocess-pending
 * Batch-reprocesses all scraped_notices with status='new' through the AI pipeline.
 *
 * Run: npm run reprocess
 *
 * For each pending notice it:
 *  1. Downloads the PDF
 *  2. Hits /api/ocr → /api/ai (the same pipeline the scraper uses)
 *  3. On success, marks the scraped_notice as 'processed'
 *  4. On failure, marks it as 'failed' and logs the error
 */

import { supabase } from './supabase.js';
import { downloadPdf } from './downloader.js';
import { triggerAIPipeline } from './pipeline.js';
import { createProcessingJob, markJobCompleted } from './queue.js';

const BATCH_SIZE = 5;   // Process N notices at a time (avoid rate limits)
const DELAY_MS   = 3000; // Wait between each notice

async function reprocessPending(): Promise<void> {
  console.log('🔄 Batch Reprocessor starting...\n');

  // Fetch all pending notices ordered oldest-first, only from the actual notices path
  const { data: pending, error } = await supabase
    .from('scraped_notices')
    .select('id, title, pdf_url, status')
    .in('status', ['new', 'pending'])
    .like('pdf_url', '%News_content/%')  // only real notice PDFs
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Failed to fetch pending notices:', error.message);
    process.exit(1);
  }

  if (!pending || pending.length === 0) {
    console.log('✅ No pending notices found. Everything is up to date!');
    return;
  }

  console.log(`📋 Found ${pending.length} pending notice(s) to process:\n`);
  pending.forEach((n, i) =>
    console.log(`  ${i + 1}. [${n.status}] ${n.title?.substring(0, 80)}`)
  );
  console.log('');

  let succeeded = 0;
  let failed = 0;

  for (const notice of pending) {
    console.log(`\n──────────────────────────────────────────────`);
    console.log(`📄 Processing: ${notice.title?.substring(0, 80)}`);
    console.log(`   URL: ${notice.pdf_url}`);

    try {
      // Mark as 'processing' so concurrent runs don't double-process
      await supabase
        .from('scraped_notices')
        .update({ status: 'processing' })
        .eq('id', notice.id);

      // Download PDF
      const pdfBuffer = await downloadPdf(notice.pdf_url);
      console.log(`   ✅ Downloaded (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

      // Create a job entry
      let jobId: string | null = null;
      try {
        jobId = await createProcessingJob(notice.id, notice.pdf_url);
      } catch (jobErr) {
        console.warn('   ⚠️ Could not create processing job (may already exist):', jobErr);
      }

      // Trigger the full AI pipeline (OCR → AI → DB save → email)
      const success = await triggerAIPipeline(pdfBuffer, notice.pdf_url, notice.title ?? 'Untitled');

      if (success) {
        // Mark as processed
        await supabase
          .from('scraped_notices')
          .update({ status: 'processed' })
          .eq('id', notice.id);

        if (jobId) await markJobCompleted(jobId);

        console.log(`   🎉 Pipeline succeeded! Notice saved & email sent.`);
        succeeded++;
      } else {
        // Pipeline failed — reset to 'new' so it can be retried later
        await supabase
          .from('scraped_notices')
          .update({ status: 'failed' })
          .eq('id', notice.id);

        console.log(`   ❌ Pipeline failed. Marked as 'failed'.`);
        failed++;
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err instanceof Error ? err.message : err);

      await supabase
        .from('scraped_notices')
        .update({ status: 'failed' })
        .eq('id', notice.id);

      failed++;
    }

    // Delay between requests to avoid hammering the AI API
    if (notice !== pending[pending.length - 1]) {
      console.log(`   ⏳ Waiting ${DELAY_MS / 1000}s before next notice...`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`🏁 Batch complete! Succeeded: ${succeeded} | Failed: ${failed} | Total: ${pending.length}`);
  
  // Show how many remain
  const { count } = await supabase
    .from('scraped_notices')
    .select('id', { count: 'exact', head: true })
    .in('status', ['new', 'pending']);
  
  if ((count ?? 0) > 0) {
    console.log(`\n⚠️  ${count} notices still pending. Run 'npm run reprocess' again to continue.`);
  } else {
    console.log('\n✅ All notices have been processed!');
  }
}

reprocessPending().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
