import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeadlineCategory = 'fee' | 'exam' | 'registration' | 'other';

interface Deadline {
  id: string;
  title: string;
  description: string | null;
  date: string; // ISO date string YYYY-MM-DD
  category: DeadlineCategory;
  email_sent: boolean;
  whatsapp_sent: boolean;
  created_at: string;
}

interface CreateDeadlineBody {
  title: string;
  description?: string;
  date: string;
  category?: DeadlineCategory;
}

interface UpdateDeadlineBody {
  id: string;
  title?: string;
  description?: string;
  date?: string;
  category?: DeadlineCategory;
  email_sent?: boolean;
  whatsapp_sent?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: validate ISO date string YYYY-MM-DD
// ---------------------------------------------------------------------------
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

// ---------------------------------------------------------------------------
// Helper: validate category
// ---------------------------------------------------------------------------
const VALID_CATEGORIES: DeadlineCategory[] = ['fee', 'exam', 'registration', 'other'];

function isValidCategory(value: unknown): value is DeadlineCategory {
  return typeof value === 'string' && VALID_CATEGORIES.includes(value as DeadlineCategory);
}

// ---------------------------------------------------------------------------
// GET /api/deadlines
// Returns all deadlines ordered by date ASC
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();

  try {
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      // If table doesn't exist yet, return empty array with a warning
      if (
        error.message.toLowerCase().includes('relation') &&
        error.message.toLowerCase().includes('does not exist')
      ) {
        return NextResponse.json(
          {
            success: true,
            data: [] as Deadline[],
            meta: {
              total: 0,
              warning:
                'The `deadlines` table does not exist yet. ' +
                'Please run the migration SQL to create it.',
            },
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const deadlines = (data ?? []) as Deadline[];

    return NextResponse.json(
      {
        success: true,
        data: deadlines,
        meta: { total: deadlines.length },
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

// ---------------------------------------------------------------------------
// POST /api/deadlines
// Body: { title, description?, date, category? }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();

  // ------------------------------------------------------------------
  // 1. Parse body
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

  const { title, description, date, category } = body as unknown as CreateDeadlineBody;


  // ------------------------------------------------------------------
  // 2. Validate required fields
  // ------------------------------------------------------------------
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid `title` field (must be a non-empty string)' },
      { status: 400 },
    );
  }

  if (!isValidDate(date)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing or invalid `date` field (must be a valid ISO date string YYYY-MM-DD)',
      },
      { status: 400 },
    );
  }

  const resolvedCategory: DeadlineCategory = isValidCategory(category) ? category : 'other';

  // ------------------------------------------------------------------
  // 3. Insert
  // ------------------------------------------------------------------
  try {
    const { data, error } = await supabase
      .from('deadlines')
      .insert({
        title: title.trim(),
        description: description?.trim() ?? null,
        date,
        category: resolvedCategory,
        email_sent: false,
        whatsapp_sent: false,
      })
      .select('*')
      .single();

    if (error) {
      if (
        error.message.toLowerCase().includes('relation') &&
        error.message.toLowerCase().includes('does not exist')
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The `deadlines` table does not exist. Please run the migration SQL to create it first.',
          },
          { status: 500 },
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
        data: data as Deadline,
        message: 'Deadline created successfully',
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${message}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/deadlines
// Body: { id, ...fields to update }
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();

  // ------------------------------------------------------------------
  // 1. Parse body
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

  const { id, title, description, date, category, email_sent, whatsapp_sent } =
    body as unknown as UpdateDeadlineBody;


  // ------------------------------------------------------------------
  // 2. Validate id
  // ------------------------------------------------------------------
  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid `id` field (must be a string)' },
      { status: 400 },
    );
  }

  // ------------------------------------------------------------------
  // 3. Build update payload (only include provided fields)
  // ------------------------------------------------------------------
  const updatePayload: Partial<Omit<Deadline, 'id' | 'created_at'>> = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { success: false, error: '`title` must be a non-empty string' },
        { status: 400 },
      );
    }
    updatePayload.title = title.trim();
  }

  if (description !== undefined) {
    updatePayload.description = typeof description === 'string' ? description.trim() : null;
  }

  if (date !== undefined) {
    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          success: false,
          error: '`date` must be a valid ISO date string YYYY-MM-DD',
        },
        { status: 400 },
      );
    }
    updatePayload.date = date;
  }

  if (category !== undefined) {
    if (!isValidCategory(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `\`category\` must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 },
      );
    }
    updatePayload.category = category;
  }

  if (email_sent !== undefined) {
    if (typeof email_sent !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '`email_sent` must be a boolean' },
        { status: 400 },
      );
    }
    updatePayload.email_sent = email_sent;
  }

  if (whatsapp_sent !== undefined) {
    if (typeof whatsapp_sent !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '`whatsapp_sent` must be a boolean' },
        { status: 400 },
      );
    }
    updatePayload.whatsapp_sent = whatsapp_sent;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields provided to update' },
      { status: 400 },
    );
  }

  // ------------------------------------------------------------------
  // 4. Perform update
  // ------------------------------------------------------------------
  try {
    const { data, error } = await supabase
      .from('deadlines')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: `No deadline found with id: ${id}` },
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
        data: data as Deadline,
        message: `Deadline ${id} updated successfully`,
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

// ---------------------------------------------------------------------------
// DELETE /api/deadlines?id=<uuid>
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();

  // ------------------------------------------------------------------
  // 1. Extract id from query params
  // ------------------------------------------------------------------
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing `id` query parameter. Usage: DELETE /api/deadlines?id=<uuid>',
      },
      { status: 400 },
    );
  }

  // ------------------------------------------------------------------
  // 2. Check deadline exists before deleting
  // ------------------------------------------------------------------
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('deadlines')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: `No deadline found with id: ${id}` },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `No deadline found with id: ${id}` },
        { status: 404 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Unexpected error checking deadline: ${message}` },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------------
  // 3. Delete the deadline
  // ------------------------------------------------------------------
  try {
    const { error } = await supabase
      .from('deadlines')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Deadline ${id} deleted successfully`,
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
