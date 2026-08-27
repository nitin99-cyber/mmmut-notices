import { NextResponse } from "next/server";
import { checkOcrHealth, processOCR } from "@/lib/ocr";
import { shouldUseVision, detectLargeNotice } from "@/lib/noticeRouter";

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

    if (!file.name.match(/\.(pdf|jpe?g|png)$/i)) {
  return NextResponse.json({ success: false, error: "Only PDF, JPG, and PNG files are accepted" }, { status: 400 });
}

    // Step 1: Check OCR health
    const health = await checkOcrHealth();

    if (!health.available) {
      return NextResponse.json({
        success: true,
        ocr_available: false,
        ocr_health: health,
        decision: {
          use_vision: true,
          reason: `OCR service unavailable: ${health.error} → falling back to Gemini Vision`,
        },
      });
    }

    // Step 2: Process with OCR
    let ocrData;

    try {
      ocrData = await processOCR(file, 1); // Only first page
    } catch (err) {
      return NextResponse.json({
        success: true,
        ocr_available: false,
        ocr_error: err instanceof Error ? err.message : String(err),
        decision: {
          use_vision: true,
          reason: `OCR processing failed → falling back to Gemini Vision`,
        },
      });
    }

    // Step 3: Determine processing path
    const useVision = shouldUseVision(
      ocrData.confidence,
      ocrData.character_count
    );

    const largeCheck = detectLargeNotice(
      ocrData.page_count,
      ocrData.text
    );

    return NextResponse.json({
      success: true,
      ocr_available: true,
      ocr_health: health,
      ocr: {
        method: ocrData.method,
        confidence: ocrData.confidence,
        character_count: ocrData.character_count,
        page_count: ocrData.page_count,
        pages_processed: ocrData.pages_processed,
        text_preview: ocrData.text.substring(0, 300),
        text: ocrData.text,
        image_base64: ocrData.image_base64,
      },
      large_notice: largeCheck,
      decision: {
        use_vision: useVision,
        reason: useVision
          ? `Confidence (${ocrData.confidence}%) too low or text too short (${ocrData.character_count} chars) → using Vision`
          : `Confidence (${ocrData.confidence}%) sufficient with ${ocrData.character_count} chars → using Text`,
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
