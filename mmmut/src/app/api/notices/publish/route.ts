import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  isNoticeSuccessfullyParsed,
  publishNoticeToWhatsAppChannel,
  getOpenWAConfig,
} from "@/lib/whatsapp";

/**
 * POST /api/notices/publish
 * Body: { id: string, force?: boolean }
 *
 * Broadcasts a notice to the WhatsApp Channel via OpenWA.
 * Strictly verifies that the notice is successfully parsed before sending.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, force } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid `id` field" },
        { status: 400 }
      );
    }

    const openwaConfig = getOpenWAConfig();
    if (!openwaConfig) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenWA is not configured. Please set OPENWA_BASE_URL and OPENWA_CHANNEL_JID in .env",
        },
        { status: 503 }
      );
    }

    const supabase = getServerSupabase();

    // Fetch notice from DB
    const { data: notice, error: fetchError } = await supabase
      .from("notices")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !notice) {
      return NextResponse.json(
        { success: false, error: `Notice not found with ID: ${id}` },
        { status: 404 }
      );
    }

    // Strict validation unless force is true
    if (!force) {
      const validation = isNoticeSuccessfullyParsed(notice);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot publish: Notice is not successfully parsed (${validation.reason})`,
          },
          { status: 422 }
        );
      }
    }

    // Publish to WhatsApp Channel
    const result = await publishNoticeToWhatsAppChannel(notice, { force: !!force });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to broadcast to WhatsApp: ${result.error}`,
        },
        { status: 502 }
      );
    }

    // Update notice status in Supabase
    const { error: updateError } = await supabase
      .from("notices")
      .update({
        sent: true,
        status: "published",
      })
      .eq("id", id);

    if (updateError) {
      console.warn("Notice published to WhatsApp but failed to update status in DB:", updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Notice "${notice.title}" broadcasted to WhatsApp Channel successfully!`,
      messageId: result.messageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${message}` },
      { status: 500 }
    );
  }
}
