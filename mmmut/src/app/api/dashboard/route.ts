import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getServerSupabase();

    // 1. Stats Aggregation
    const [
      { count: totalScraped },
      { count: deadLinks },
      { count: pendingNotices },
      { count: sentNotices },
      { count: sentDeadlines },
      { count: upcomingDeadlines }
    ] = await Promise.all([
      supabase.from('scraped_notices').select('*', { count: 'exact', head: true }),
      supabase.from('scraped_notices').select('*', { count: 'exact', head: true }).eq('status', 'dead_link'),
      supabase.from('notices').select('*', { count: 'exact', head: true }).eq('sent', false),
      supabase.from('notices').select('*', { count: 'exact', head: true }).eq('sent', true),
      supabase.from('deadlines').select('*', { count: 'exact', head: true }).eq('whatsapp_sent', true),
      supabase.from('deadlines').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0])
    ]);

    const sentMessages = (sentNotices || 0) + (sentDeadlines || 0);

    // 2. AI Usage Tracking (scan recent notices for pipeline_log)
    // We'll fetch the last 100 notices to aggregate AI models used
    const { data: recentNotices } = await supabase
      .from('notices')
      .select('page_count, pipeline_log')
      .order('created_at', { ascending: false })
      .limit(100);

    let geminiVision = 0;
    let geminiText = 0;
    let groq = 0;
    let estimatedTokens = 0;

    if (recentNotices) {
      recentNotices.forEach(notice => {
        const pages = notice.page_count || 1;
        // Estimate: 800 tokens per page for text, 1200 for vision
        const log = notice.pipeline_log as any;
        if (log && log.ai_model) {
          if (log.ai_model.includes('vision')) {
            geminiVision++;
            estimatedTokens += pages * 1200;
          } else if (log.ai_model.toLowerCase().includes('groq')) {
            groq++;
            // Groq doesn't use Gemini limits, but we can track tokens broadly
          } else {
            geminiText++;
            estimatedTokens += pages * 800;
          }
        }
      });
    }

    // 3. Activity Feed (Chronological merge of recent events)
    // Fetch last 15 scraped notices, last 15 processed notices, last 5 deadlines
    const [
      { data: recentScrapes },
      { data: recentProcessed },
      { data: recentDeadlineEvents }
    ] = await Promise.all([
      supabase.from('scraped_notices').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(15),
      supabase.from('notices').select('id, title, sent, pipeline_log, created_at').order('created_at', { ascending: false }).limit(15),
      supabase.from('deadlines').select('id, title, date, created_at').order('created_at', { ascending: false }).limit(5)
    ]);

    type ActivityEvent = { id: string; type: string; title: string; timestamp: string; status: string; detail?: string };
    const activityFeed: ActivityEvent[] = [];

    if (recentScrapes) {
      recentScrapes.forEach(s => {
        activityFeed.push({
          id: `scrape_${s.id}`,
          type: 'scrape',
          title: s.title || 'Untitled Notice',
          timestamp: s.created_at,
          status: s.status === 'dead_link' ? 'Dead Link' : 'Scraped',
          detail: 'Found on MMMUT website'
        });
      });
    }

    if (recentProcessed) {
      recentProcessed.forEach(n => {
        activityFeed.push({
          id: `process_${n.id}`,
          type: 'process_job',
          title: n.title || 'Untitled Notice',
          timestamp: n.created_at,
          status: 'Processed',
          detail: (n.pipeline_log as any)?.ai_model ? `Processed via ${(n.pipeline_log as any).ai_model}` : 'Processed by AI'
        });
        
        if (n.sent) {
          // Fake a timestamp slightly after creation for the 'sent' event since we don't track sent_at currently
          const sentDate = new Date(n.created_at);
          sentDate.setMinutes(sentDate.getMinutes() + 5);
          activityFeed.push({
            id: `sent_${n.id}`,
            type: 'notice_sent',
            title: n.title || 'Untitled Notice',
            timestamp: sentDate.toISOString(),
            status: 'Sent',
            detail: 'Shared via WhatsApp'
          });
        }
      });
    }

    if (recentDeadlineEvents) {
      recentDeadlineEvents.forEach(d => {
        activityFeed.push({
          id: `dl_${d.id}`,
          type: 'deadline',
          title: `Deadline Added: ${d.title}`,
          timestamp: d.created_at,
          status: 'Tracked',
          detail: `Due on ${new Date(d.date).toLocaleDateString()}`
        });
      });
    }

    // Sort combined feed descending
    activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      stats: {
        totalScraped: totalScraped || 0,
        pendingNotices: pendingNotices || 0,
        deadLinks: deadLinks || 0,
        sentMessages,
        upcomingDeadlines: upcomingDeadlines || 0
      },
      aiUsage: {
        models: { gemini_vision: geminiVision, gemini_text: geminiText, groq },
        estimatedTokensUsed: estimatedTokens,
        tokenLimit: 1000000 // Free tier approx daily soft limit for visualization
      },
      activityFeed: activityFeed.slice(0, 30) // Return top 30 events
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
