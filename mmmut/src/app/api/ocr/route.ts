import { NextResponse } from "next/server";
import { shouldUseVision } from "@/lib/noticeRouter";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    const fileBytes = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(fileBytes);
    const ocrBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    const ocrFormData = new FormData();
    ocrFormData.append("file", ocrBlob, file.name);

    let ocrData;

    try {
      const ocrResponse = await fetch("http://127.0.0.1:8000/ocr", {
        method: "POST",
        body: ocrFormData,
      });

      if (!ocrResponse.ok) {
        throw new Error(`OCR service returned ${ocrResponse.status}`);
      }

      ocrData = await ocrResponse.json();

      if (ocrData.error) {
        throw new Error(ocrData.error);
      }
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OCR service unavailable. Make sure FastAPI is running on port 8000.",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    const useVision = shouldUseVision(
      ocrData.confidence,
      ocrData.character_count
    );

    return NextResponse.json({
      success: true,
      ocr: {
        method: ocrData.method,
        confidence: ocrData.confidence,
        character_count: ocrData.character_count,
        text_preview: ocrData.text.substring(0, 300),
        text: ocrData.text,
        image_base64: ocrData.image_base64
      },
      decision: {
        use_vision: useVision,
        reason: useVision
          ? `Confidence (${ocrData.confidence}%) too low or text too short (${ocrData.character_count} chars) → using Vision on raw PDF/Image`
          : `Confidence (${ocrData.confidence}%) sufficient with ${ocrData.character_count} chars → using Text model`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error during OCR processing",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
