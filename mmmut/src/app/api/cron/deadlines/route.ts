import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { sendDeadlineAlert } from '@/lib/email';

export const dynamic = 'force-dynamic'; // Ensure it runs dynamically on Vercel Cron

export async function GET(request: Request) {
  // Optional: Vercel CRON Auth Check
  // Vercel passes an Authorization header with a Bearer token matching CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // Calculate tomorrow's date string in YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find deadlines due tomorrow where email_sent is false
    const { data: deadlines, error } = await supabase
      .from('deadlines')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('email_sent', false);

    if (error) {
      throw new Error(error.message);
    }

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ success: true, message: 'No deadlines due tomorrow.' });
    }

    const processedIds: string[] = [];

    // Send emails for each deadline
    for (const deadline of deadlines) {
      await sendDeadlineAlert(
        deadline.title,
        deadline.date,
        deadline.category,
        deadline.description
      );

      processedIds.push(deadline.id);
    }

    // Mark these deadlines as email_sent = true
    if (processedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('deadlines')
        .update({ email_sent: true })
        .in('id', processedIds);

      if (updateError) {
        console.error('Failed to update email_sent status:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedIds.length} deadline alerts.`,
      notified_ids: processedIds
    });

  } catch (error: any) {
    console.error('Cron Deadlines Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
