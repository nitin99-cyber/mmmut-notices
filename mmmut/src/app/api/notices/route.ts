import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  detail?: string;
  timestamp?: string;
}

interface PipelineLog {
  ocr_method?: string;
  ocr_confidence?: number;
  ocr_char_count?: number;
  ai_model?: string;
  processing_method?: string;
  decision_reason?: string;
  stages?: PipelineStage[];
}

interface Notice {
  id: string;
  title: string | null;
  category: string | null;
  audience: string | null;
  summary: string | null;
  english_translation: string | null;
  whatsapp_message: string | null;
  processing_method: string | null;
  pdf_url: string | null;
  is_large_notice: boolean | null;
  page_count: number | null;
  calendar_events: unknown | null;
  created_at: string;
  // optional columns added via migration
  sent?: boolean | null;
  pipeline_log?: PipelineLog | null;
  // joined from scraped_notices / processing_jobs
  scraped_notice?: ScrapedNotice | null;
  processing_job?: ProcessingJob | null;
}

interface ScrapedNotice {
  id: string;
  title: string | null;
  pdf_url: string | null;
  source_url: string | null;
  pdf_hash: string | null;
  publish_date: string | null;
  status: string | null;
  created_at: string;
}

interface ProcessingJob {
  id: string;
  notice_id: string;
  source: string | null;
  status: string | null;
  current_stage: string | null;
  error_message: string | null;
  retry_count: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// GET /api/notices
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();
  const warnings: string[] = [];

  // ------------------------------------------------------------------
  // 1. Fetch from `notices` table
  // ------------------------------------------------------------------
  let notices: Notice[] = [];

  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet or columns may be missing
      warnings.push(`notices table error: ${error.message}`);
    } else {
      notices = (data ?? []) as Notice[];
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Unexpected error fetching notices: ${message}`);
  }

  // ------------------------------------------------------------------
  // 2. Fetch from `scraped_notices` table (best-effort)
  // ------------------------------------------------------------------
  let scrapedNotices: ScrapedNotice[] = [];

  try {
    const { data, error } = await supabase
      .from('scraped_notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      warnings.push(`scraped_notices table error: ${error.message}`);
    } else {
      scrapedNotices = (data ?? []) as ScrapedNotice[];
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Unexpected error fetching scraped_notices: ${message}`);
  }

  // ------------------------------------------------------------------
  // 3. Fetch from `processing_jobs` table (best-effort)
  // ------------------------------------------------------------------
  let processingJobs: ProcessingJob[] = [];

  try {
    const { data, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      warnings.push(`processing_jobs table error: ${error.message}`);
    } else {
      processingJobs = (data ?? []) as ProcessingJob[];
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Unexpected error fetching processing_jobs: ${message}`);
  }

  // ------------------------------------------------------------------
  // 4. Join scraped_notices and processing_jobs into notices
  //    Match on pdf_url as the common key between notices and scraped_notices
  // ------------------------------------------------------------------
  const scrapedByPdfUrl = new Map<string, ScrapedNotice>();
  for (const sn of scrapedNotices) {
    if (sn.pdf_url) {
      scrapedByPdfUrl.set(sn.pdf_url, sn);
    }
  }

  const jobsByNoticeId = new Map<string, ProcessingJob>();
  for (const job of processingJobs) {
    if (job.notice_id) {
      // Keep the most recent job per notice_id
      const existing = jobsByNoticeId.get(job.notice_id);
      if (!existing || job.created_at > existing.created_at) {
        jobsByNoticeId.set(job.notice_id, job);
      }
    }
  }

  const enrichedNotices = notices.map((notice) => {
    const scraped = notice.pdf_url ? scrapedByPdfUrl.get(notice.pdf_url) ?? null : null;
    const job = scraped ? (jobsByNoticeId.get(scraped.id) ?? null) : null;

    return {
      ...notice,
      // Normalise optional columns — default to null if not present
      sent: notice.sent ?? null,
      pipeline_log: notice.pipeline_log ?? null,
      scraped_notice: scraped,
      processing_job: job,
    };
  });

  // ------------------------------------------------------------------
  // 5. Return response
  // ------------------------------------------------------------------
  return NextResponse.json(
    {
      success: true,
      data: enrichedNotices,
      meta: {
        total: enrichedNotices.length,
        scraped_notices_count: scrapedNotices.length,
        processing_jobs_count: processingJobs.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// PATCH /api/notices
// Body: { id: string; sent: boolean }
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();

  // ------------------------------------------------------------------
  // 1. Parse and validate request body
  // ------------------------------------------------------------------
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { id, sent } = body as { id?: string; sent?: boolean };

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid `id` field (must be a string)' },
      { status: 400 },
    );
  }

  if (typeof sent !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid `sent` field (must be a boolean)' },
      { status: 400 },
    );
  }

  // ------------------------------------------------------------------
  // 2. Perform the update
  // ------------------------------------------------------------------
  try {
    const { data, error } = await supabase
      .from('notices')
      .update({ sent })
      .eq('id', id)
      .select('id, sent')
      .single();

    if (error) {
      // Column might not exist yet — surface a clear message
      if (
        error.message.includes('column') &&
        error.message.toLowerCase().includes('sent')
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The `sent` column does not exist on the notices table. ' +
              'Please run the migration to add it: ' +
              'ALTER TABLE notices ADD COLUMN IF NOT EXISTS sent BOOLEAN DEFAULT false;',
          },
          { status: 500 },
        );
      }

      if (error.code === 'PGRST116') {
        // No rows matched
        return NextResponse.json(
          { success: false, error: `No notice found with id: ${id}` },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Notice ${id} sent status updated to ${sent}`,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${message}` },
      { status: 500 },
    );
  }
}
