import { API_BASE_URL } from './config.js';

/**
 * Automatically triggers the Next.js AI pipeline for a scraped notice.
 * Simulates a browser FormData upload to /api/ocr and then /api/ai.
 *
 * @param pdfBuffer The downloaded PDF buffer
 * @param pdfUrl The URL of the PDF
 * @param title The scraped title of the notice
 */
export async function triggerAIPipeline(
  pdfBuffer: Buffer,
  pdfUrl: string,
  title: string
): Promise<boolean> {
  console.log(`🤖 Triggering automated AI pipeline for: ${title}`);

  try {
    // ─── Guard: Vercel Serverless Payload Limit (4.5 MB) ─────────────
    if (pdfBuffer.length > 4.2 * 1024 * 1024) {
      console.warn(`   ⚠️ PDF size is ${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB, which exceeds Vercel's 4.5 MB serverless limit.`);
      console.warn(`   ⚠️ Skipping automated HTTP upload. Please process this notice manually in the admin dashboard.`);
      return false;
    }

    // ─── Step 1: Hit OCR API ───────────────────────────────────────
    console.log(`   ➡️ POST ${API_BASE_URL}/api/ocr`);
    
    // Create FormData for OCR
    const ocrFormData = new FormData();
    const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
    ocrFormData.append('file', pdfBlob, 'notice.pdf');

    const ocrRes = await fetch(`${API_BASE_URL}/api/ocr`, {
      method: 'POST',
      body: ocrFormData,
    });

    if (!ocrRes.ok) {
      throw new Error(`OCR API returned ${ocrRes.status}: ${ocrRes.statusText}`);
    }

    const ocrData = await ocrRes.json();
    if (!ocrData.success) {
      throw new Error(`OCR Processing Failed: ${ocrData.error || ocrData.ocr_error}`);
    }

    console.log(`   ✅ OCR Complete. Decision: ${ocrData.decision.reason}`);

    // ─── Step 2: Hit AI API ────────────────────────────────────────
    console.log(`   ➡️ POST ${API_BASE_URL}/api/ai`);
    
    const aiFormData = new FormData();
    aiFormData.append('useVision', String(ocrData.decision.use_vision));
    aiFormData.append('pageCount', String(ocrData.ocr?.page_count || 1));
    aiFormData.append('pdfUrl', pdfUrl);
    
    if (ocrData.decision.use_vision) {
      aiFormData.append('file', pdfBlob, 'notice.pdf');
      if (ocrData.ocr?.image_base64) {
        aiFormData.append('imageBase64', ocrData.ocr.image_base64);
      }
    } else {
      aiFormData.append('ocrText', ocrData.ocr.text);
    }

    const aiRes = await fetch(`${API_BASE_URL}/api/ai`, {
      method: 'POST',
      body: aiFormData,
    });

    if (!aiRes.ok) {
      throw new Error(`AI API returned ${aiRes.status}: ${aiRes.statusText}`);
    }

    const aiData = await aiRes.json();
    
    if (!aiData.success) {
      throw new Error(`AI Processing Failed: ${aiData.error || aiData.details}`);
    }

    // The API can complete AI generation but still fail to persist the notice.
    // Do not let the scraper mark such a record as processed.
    if (aiData.database?.saved !== true) {
      throw new Error(`AI response did not confirm database save: ${aiData.database?.error || 'unknown persistence error'}`);
    }

    console.log(`   ✅ AI Pipeline Complete! Notice saved in DB and email sent.`);
    return true;

  } catch (error) {
    console.error(`   ❌ Automated Pipeline Failed:`, error instanceof Error ? error.message : String(error));
    console.log(`   ⚠️ Notice remains in pending state. You can process it manually from the dashboard.`);
    return false;
  }
}
