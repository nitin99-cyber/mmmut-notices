/**
 * Self-healing worker for notices that failed after discovery.
 *
 * This worker deliberately does not fetch AllRecord. It only claims retryable
 * rows already stored in scraped_notices, so a transient PDF/API failure does
 * not rerun the full production scraper.
 */

import { supabase } from './supabase.js';
import { downloadPdf } from './downloader.js';
import { triggerAIPipeline } from './pipeline.js';
import { createProcessingJob, markJobCompleted } from './queue.js';

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
const BACKOFF_MINUTES = [5, 15, 30, 60, 120];

type RetryNotice = {
  id: string;
  title: string;
  pdf_url: string;
  status: string;
  retry_count: number | null;
  next_retry_at: string | null;
  processing_started_at: string | null;
};

function retryDelay(attempt: number): number {
  return BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)] * 60_000;
}

function isEligible(notice: RetryNotice, now: number): boolean {
  if (notice.status === 'processing') {
    return !!notice.processing_started_at &&
      now - Date.parse(notice.processing_started_at) >= STALE_PROCESSING_MS;
  }
  if (!notice.next_retry_at) return true;
  return Date.parse(notice.next_retry_at) <= now;
}

async function updateFailure(notice: RetryNotice, error: unknown, attempt: number): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = attempt >= MAX_ATTEMPTS;
  const nextRetryAt = exhausted ? null : new Date(Date.now() + retryDelay(attempt)).toISOString();

  await supabase
    .from('scraped_notices')
    .update({
      status: exhausted ? 'retry_exhausted' : 'failed',
      retry_count: attempt,
      next_retry_at: nextRetryAt,
      last_error: message.slice(0, 2000),
      processing_started_at: null,
    })
    .eq('id', notice.id);

  console.error(`   ❌ Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);
  if (!exhausted) {
    console.log(`   ⏳ Next retry scheduled for ${nextRetryAt}`);
  } else {
    console.log('   🛑 Retry limit reached; marked retry_exhausted.');
  }
}

async function retryFailed(): Promise<void> {
  const now = Date.now();
  console.log('♻️ Failed-notice retry worker starting...');

  const { data, error } = await supabase
    .from('scraped_notices')
    .select('id, title, pdf_url, status, retry_count, next_retry_at, processing_started_at')
    .in('status', ['download_failed', 'failed', 'new', 'pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw new Error(`Failed to load retryable notices: ${error.message}`);

  const notices = ((data ?? []) as RetryNotice[])
    .filter((notice) => (notice.retry_count ?? 0) < MAX_ATTEMPTS)
    .filter((notice) => isEligible(notice, now))
    .slice(0, BATCH_SIZE);

  if (notices.length === 0) {
    console.log('✅ No failed notices are due for retry.');
    return;
  }

  let succeeded = 0;
  for (const notice of notices) {
    const attempt = (notice.retry_count ?? 0) + 1;
    console.log(`\n📄 Retrying [${attempt}/${MAX_ATTEMPTS}] ${notice.title}`);

    // Claim the row before doing network/AI work. The status plus timestamp
    // lets a later run recover if this worker is killed mid-processing.
    const { error: claimError } = await supabase
      .from('scraped_notices')
      .update({ status: 'processing', processing_started_at: new Date().toISOString(), retry_count: attempt })
      .eq('id', notice.id)
      .eq('status', notice.status);

    if (claimError) {
      console.error(`   ⚠️ Could not claim notice: ${claimError.message}`);
      continue;
    }

    try {
      const pdfBuffer = await downloadPdf(notice.pdf_url);
      const jobId = await createProcessingJob(notice.id, notice.pdf_url);
      const success = await triggerAIPipeline(pdfBuffer, notice.pdf_url, notice.title);

      if (!success) throw new Error('AI pipeline returned failure');

      await supabase
        .from('scraped_notices')
        .update({
          status: 'processed',
          next_retry_at: null,
          last_error: null,
          processing_started_at: null,
        })
        .eq('id', notice.id);
      await markJobCompleted(jobId);
      console.log('   ✅ Notice recovered successfully.');
      succeeded++;
    } catch (err) {
      await updateFailure(notice, err, attempt);
    }
  }

  console.log(`\n🏁 Retry worker complete. Recovered: ${succeeded}/${notices.length}`);
}

retryFailed().catch((err) => {
  console.error('💥 Retry worker failed:', err);
  process.exit(1);
});
