import { NextResponse } from "next/server";
import {
  type ProcessedNotice,
  processNoticeFromText,
  processNoticeFromVision,
} from "@/lib/geminiProcessor";
import { detectLargeNotice } from "@/lib/noticeRouter";
import { getServerSupabase } from "@/lib/supabase";
import { sendAdminNotification, sendFailureNotification } from "@/lib/email";
import {
  isNoticeSuccessfullyParsed,
  publishNoticeToWhatsAppChannel,
  getOpenWAConfig,
} from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const useVisionStr = formData.get("useVision") as string;
    const ocrText = formData.get("ocrText") as string;
    const imageBase64 = formData.get("imageBase64") as string;
    const useVision = useVisionStr === "true";
    const file = formData.get("file") as File | null;
    const pdfUrl = (formData.get("pdfUrl") as string) || undefined;

    // Page count from OCR (if available)
    const pageCountStr = formData.get("pageCount") as string;
    const pageCount = pageCountStr ? parseInt(pageCountStr, 10) : 1;

    // Detect large notice
    const largeCheck = detectLargeNotice(pageCount, ocrText || undefined);
    const isLargeNotice = largeCheck.isLarge;

    let notice;
    let aiError: string | null = null;

    try {
      if (useVision) {
        if (!file) throw new Error("File is required for vision processing");
        const fileBytes = await file.arrayBuffer();
        const pdfBuffer = Buffer.from(fileBytes);
        notice = await processNoticeFromVision(pdfBuffer, {
          imageBase64,
          isLargeNotice,
          pageCount,
          pdfUrl,
          mimeType: file.type,
        });
      } else {
        if (!ocrText) throw new Error("OCR text is required for text processing");
        notice = await processNoticeFromText(ocrText, {
          isLargeNotice,
          pageCount,
          pdfUrl,
        });
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      
      // Notify admin of failure so they can process manually
      await sendFailureNotification(aiError).catch(console.error);

      return NextResponse.json(
        {
          success: false,
          error: "AI processing failed",
          details: aiError,
        },
        { status: 500 }
      );
    }

    // ─── STRICT VALIDATION: Check if notice was successfully parsed ───────
    const parseValidation = isNoticeSuccessfullyParsed(notice);
    if (!parseValidation.valid) {
      const errorMsg = `Notice parsing incomplete/invalid: ${parseValidation.reason}`;
      console.warn(`⚠️ [AI Route] ${errorMsg}`);
      await sendFailureNotification(errorMsg).catch(console.error);

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: parseValidation.reason,
          notice,
        },
        { status: 422 }
      );
    }

    // ─── WhatsApp Channel Broadcast (OpenWA) ─────────────────────────────
    // Broadcast ONLY if notice is successfully parsed and auto-publishing is enabled or OpenWA configured
    let whatsappBroadcast: { sent: boolean; messageId?: string; error?: string } = { sent: false };
    const autoPublish = process.env.AUTO_PUBLISH_WHATSAPP !== "false";
    const openwaConfig = getOpenWAConfig();

    if (autoPublish && openwaConfig) {
      console.log(`📡 [AI Route] Triggering automated WhatsApp Channel broadcast for: "${notice.title}"`);
      const waResult = await publishNoticeToWhatsAppChannel(notice);
      if (waResult.success) {
        whatsappBroadcast = { sent: true, messageId: waResult.messageId };
        console.log(`✅ [AI Route] Successfully posted to WhatsApp Channel.`);
      } else {
        whatsappBroadcast = { sent: false, error: waResult.error };
        console.warn(`⚠️ [AI Route] WhatsApp Channel post warning:`, waResult.error);
      }
    } else {
      console.log(`ℹ️ [AI Route] WhatsApp auto-publish skipped (OpenWA configured: ${!!openwaConfig}, AUTO_PUBLISH: ${process.env.AUTO_PUBLISH_WHATSAPP})`);
    }

    // Save to Supabase
    let dbResult: { id: string } | null = null;
    let dbError: string | null = null;

    try {
      const supabase = getServerSupabase();

      const pipelineLog = {
        ocr_method: useVision ? null : "easyocr",
        ai_model: notice.processing_method, // Reflects actual model: gemini_text | gemini_vision | groq_text | groq_vision
        processing_method: notice.processing_method,
        decision_reason: useVision ? "Triggered via vision path" : "Triggered via text path",
        whatsapp_broadcast: whatsappBroadcast,
        stages: [
          { name: "Upload & OCR", status: "done", timestamp: new Date().toISOString() },
          { name: "Decision Engine", status: "done", detail: useVision ? "→ Vision Path" : "→ Text Path", timestamp: new Date().toISOString() },
          { name: "AI Processing", status: "done", detail: `${notice.processing_method} · ${notice.category}`, timestamp: new Date().toISOString() },
          { name: "WhatsApp Broadcast", status: whatsappBroadcast.sent ? "done" : "skipped", detail: whatsappBroadcast.sent ? "Sent to Channel" : (whatsappBroadcast.error || "Manual publish"), timestamp: new Date().toISOString() },
          { name: "Save to Database", status: "active", timestamp: new Date().toISOString() }
        ]
      };

      const { data, error } = await supabase
        .from("notices")
        .insert({
          title: notice.title,
          category: notice.category,
          audience: notice.audience,
          summary: notice.summary,
          english_translation: notice.english_translation,
          important_dates: notice.important_dates,
          calendar_events: notice.calendar_events,
          whatsapp_message: notice.whatsapp_message,
          is_large_notice: notice.is_large_notice,
          page_count: notice.page_count,
          processing_method: notice.processing_method,
          pdf_url: pdfUrl || null,
          sent: whatsappBroadcast.sent,
          pipeline_log: pipelineLog,
        })
        .select()
        .single();

      if (error) {
        dbError = error.message;
      } else {
        const savedNotice = data as { id: string };
        dbResult = savedNotice;

        // Auto-extract deadlines from calendar_events OR important_dates and insert into the deadlines table
        let deadlinesToSave: { title: string; date: string; description?: string }[] = [];
        
        if (notice.calendar_events && notice.calendar_events.length > 0) {
          deadlinesToSave = notice.calendar_events.map((evt: any) => ({
            title: evt.title,
            date: evt.date,
            description: evt.description
          }));
        } else if (notice.important_dates && notice.important_dates.length > 0) {
          // Fallback to important dates if calendar_events is empty
          deadlinesToSave = notice.important_dates.map((dateStr: string) => {
            const parts = dateStr.split(':');
            const date = parts[0]?.trim() || '';
            const desc = parts.slice(1).join(':')?.trim() || `From notice: ${notice.title}`;
            return {
              title: notice.title,
              date: date.length === 10 ? date : new Date().toISOString().split('T')[0], // rudimentary fallback
              description: desc
            };
          }).filter(d => d.date && d.date.length === 10 && d.date.startsWith("202")); // filter valid looking dates
        }

        if (deadlinesToSave.length > 0) {
          const categoryLower = notice.category.toLowerCase();
          const categoryMap: Record<string, string> = {
            'fee': 'fee',
            'scholarship': 'fee',
            'exam': 'exam',
            'examination': 'exam',
            'registration': 'registration',
            'admission': 'registration',
            'academic': 'other',
            'hostel': 'other',
            'placement': 'other',
            'research': 'other',
            'administrative': 'other',
            'event': 'other',
            'training/workshop': 'other',
            'sports': 'other',
            'library': 'other',
          };
          const validCategory = categoryMap[categoryLower] ?? 'other';
          
          // Import dynamic to avoid top-level issues if any
          const { generateGroqReminderMessage } = await import('@/lib/groqReminder');

          const deadlineInserts = await Promise.all(deadlinesToSave.map(async (evt) => {
            const prompt = `Title: ${evt.title}\nDate: ${evt.date}\nDescription: ${evt.description || notice.title}\nCategory: ${validCategory}`;
            let reminderMessage = notice.whatsapp_message;
            try {
              reminderMessage = await generateGroqReminderMessage(prompt);
            } catch (err) {
              console.warn("Failed to generate Groq reminder for deadline, using default notice message:", err);
            }
            return {
              notice_id: savedNotice.id,
              title: evt.title,
              description: evt.description || `From notice: ${notice.title}`,
              date: evt.date,
              category: validCategory,
              email_sent: false,
              whatsapp_sent: false,
              reminder_message: reminderMessage,
            };
          }));

          const { error: dlError } = await supabase
            .from("deadlines")
            .insert(deadlineInserts);
            
          if (dlError) {
            console.error("Failed to auto-insert deadlines:", dlError.message);
          }
        }
      }
    } catch (err) {
      dbError =
        "Supabase not configured. " +
        (err instanceof Error ? err.message : String(err));
    }

    // Send email notification to Admin unconditionally (even if DB save failed)
    const emailStatus: { sent: boolean; error?: string } = { sent: false };
    if (notice && notice.title) {
      const dummyId = dbResult?.id || "not-saved-in-db";
      try {
        await sendAdminNotification(notice.title, String(dummyId), notice.whatsapp_message);
        emailStatus.sent = true;
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
        emailStatus.error = emailErr instanceof Error ? emailErr.message : String(emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      notice,
      whatsapp: whatsappBroadcast,
      large_notice: isLargeNotice
        ? { detected: true, reason: largeCheck.reason }
        : { detected: false },
      database: dbResult
        ? { saved: true, id: dbResult.id }
        : { saved: false, error: dbError },
      email: emailStatus,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error during AI processing",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

