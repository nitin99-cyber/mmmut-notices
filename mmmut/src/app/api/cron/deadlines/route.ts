import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { sendDeadlineAlert } from '@/lib/email';
import { sendWhatsAppText, getOpenWAConfig } from '@/lib/whatsapp';

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

    // Calculate tomorrow's date string in IST (UTC+5:30) to match how deadlines are stored
    // Vercel runs in UTC, so we must offset by +5:30 before computing "tomorrow"
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const tomorrowIST = new Date(nowIST);
    tomorrowIST.setDate(tomorrowIST.getDate() + 1);
    const tomorrowStr = tomorrowIST.toISOString().split('T')[0];

    // Find deadlines due tomorrow that have NOT already been sent
    // Using .or() to get rows where email OR whatsapp still needs to be sent
    const { data: deadlines, error } = await supabase
      .from('deadlines')
      .select('*')
      .eq('date', tomorrowStr)
      .or('email_sent.eq.false,whatsapp_sent.eq.false');

    if (error) {
      throw new Error(error.message);
    }

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ success: true, message: 'No deadlines due tomorrow.' });
    }

    const openwaConfig = getOpenWAConfig();
    const processedEmailIds: string[] = [];
    const processedWhatsAppIds: string[] = [];

    for (const deadline of deadlines) {
      // 1. Send Email alert if not sent
      if (!deadline.email_sent) {
        const emailSent = await sendDeadlineAlert(
          deadline.title,
          deadline.date,
          deadline.category,
          deadline.description,
          deadline.reminder_message
        );
        if (emailSent) processedEmailIds.push(deadline.id);
      }

      // 2. Send WhatsApp Channel broadcast if not sent and OpenWA is configured
      if (!deadline.whatsapp_sent && openwaConfig) {
        const reminderMsg = deadline.reminder_message || `🚨 *REMINDER: Upcoming Deadline Tomorrow!* 🚨\n\n📌 *${deadline.title}*\n📅 *Date:* ${deadline.date}\n📂 *Category:* ${deadline.category}${deadline.description ? `\n📝 *Details:* ${deadline.description}` : ''}\n\n⚠️ Please ensure you complete this process before the deadline.\n━━━━━━━━━━━━━━━━━\n_MMMUT Notice Intelligence_`;
        const waResult = await sendWhatsAppText(reminderMsg);
        if (waResult.success) {
          processedWhatsAppIds.push(deadline.id);
        }
      }
    }

    // Update statuses in DB
    if (processedEmailIds.length > 0) {
      await supabase
        .from('deadlines')
        .update({ email_sent: true })
        .in('id', processedEmailIds);
    }

    if (processedWhatsAppIds.length > 0) {
      await supabase
        .from('deadlines')
        .update({ whatsapp_sent: true })
        .in('id', processedWhatsAppIds);
    }

    return NextResponse.json({
      success: true,
      message: `Processed deadline alerts.`,
      email_notified_ids: processedEmailIds,
      whatsapp_notified_ids: processedWhatsAppIds,
    });

  } catch (error: any) {
    console.error('Cron Deadlines Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

