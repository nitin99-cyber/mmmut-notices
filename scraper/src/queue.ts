/**
 * @module queue
 * Processing job creation for downstream notice processing pipeline.
 */

import { supabase } from './supabase.js';

/**
 * Create a new processing job in the `processing_jobs` table.
 *
 * Each scraped notice gets a corresponding job that the processing
 * pipeline picks up asynchronously. Jobs start in the 'pending' / 'queued'
 * state with zero retries.
 *
 * @param noticeId - UUID of the notice in `scraped_notices`
 * @param pdfUrl   - PDF URL (stored for convenience / debugging)
 * @returns The UUID of the newly created processing job
 * @throws Error if the insert fails
 */
export async function createProcessingJob(
  noticeId: string,
  pdfUrl: string
): Promise<string> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .insert({
      notice_id: noticeId,
      source: 'scraper',
      status: 'pending',
      current_stage: 'queued',
      retry_count: 0,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `Failed to create processing job for notice ${noticeId} (${pdfUrl}): ${error.message}`
    );
  }

  console.log(`📦 Created processing job ${data.id} for notice ${noticeId}`);
  return data.id as string;
}

/**
 * Mark a processing job as completed.
 * Used when the automated pipeline successfully processes a notice.
 */
export async function markJobCompleted(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('processing_jobs')
    .update({
      status: 'completed',
      current_stage: 'finished',
    })
    .eq('id', jobId);

  if (error) {
    console.error(`Failed to mark job ${jobId} as completed: ${error.message}`);
  } else {
    console.log(`✅ Job ${jobId} marked as completed.`);
  }
}
