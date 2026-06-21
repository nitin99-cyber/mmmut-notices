import { NextResponse } from "next/server";
import {
  processNoticeFromText,
  processNoticeFromVision,
} from "@/lib/geminiProcessor";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const useVisionStr = formData.get("useVision") as string;
    const ocrText = formData.get("ocrText") as string;
    const imageBase64 = formData.get("imageBase64") as string;
    const useVision = useVisionStr === "true";
    const file = formData.get("file") as File | null;

    let notice;
    let aiError: string | null = null;

    try {
      if (useVision) {
        if (!file) throw new Error("File is required for vision processing");
        const fileBytes = await file.arrayBuffer();
        const pdfBuffer = Buffer.from(fileBytes);
        notice = await processNoticeFromVision(pdfBuffer, imageBase64);
      } else {
        if (!ocrText) throw new Error("OCR text is required for text processing");
        notice = await processNoticeFromText(ocrText);
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
          whatsapp_message: notice.whatsapp_message,
        })
        .select()
        .single();

      if (error) {
        dbError = error.message;
      } else {
        dbResult = data;
        
        // Now that we have the ID, replace the placeholder in the message and update
        if (notice.whatsapp_message && dbResult?.id) {
          const finalMsg = notice.whatsapp_message.replace(/\[ID\]/g, String(dbResult.id));
          notice.whatsapp_message = finalMsg; // update the local object for the frontend
          
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
