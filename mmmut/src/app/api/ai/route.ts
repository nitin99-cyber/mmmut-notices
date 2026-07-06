import { NextResponse } from "next/server";
import {
  processNoticeFromText,
  processNoticeFromVision,
} from "@/lib/geminiProcessor";
import { detectLargeNotice } from "@/lib/noticeRouter";
import { getServerSupabase } from "@/lib/supabase";

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

      return NextResponse.json(
        {
          success: false,
          error: "AI processing failed",
          details: aiError,
        },
        { status: 500 }
      );
    }

    // Save to Supabase
    let dbResult = null;
    let dbError = null;

    try {
      const supabase = getServerSupabase();

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
          status: "draft",
        })
        .select()
        .single();

      if (error) {
        dbError = error.message;
      } else {
        dbResult = data;

        // Replace notice link placeholder with PDF URL
        if (notice.whatsapp_message && dbResult?.id && pdfUrl) {
          const finalMsg = notice.whatsapp_message
            .replace(/\[ID\]/g, String(dbResult.id))
            .replace(/\[NOTICE_LINK\]/g, pdfUrl);
          notice.whatsapp_message = finalMsg;

          await supabase
            .from("notices")
            .update({ whatsapp_message: finalMsg })
            .eq("id", dbResult.id);
        }
      }
    } catch (err) {
      dbError =
        "Supabase not configured. " +
        (err instanceof Error ? err.message : String(err));
    }

    return NextResponse.json({
      success: true,
      notice,
      large_notice: isLargeNotice
        ? { detected: true, reason: largeCheck.reason }
        : { detected: false },
      database: dbResult
        ? { saved: true, id: dbResult.id }
        : { saved: false, error: dbError },
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
