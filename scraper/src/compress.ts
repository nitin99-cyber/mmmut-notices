/**
 * @module compress
 * PDF compression helpers for the MMMUT scraper.
 *
 * Strategy (in order):
 *   1. Re-save the full PDF with pdf-lib  → removes metadata bloat,
 *      duplicate objects, and dead cross-reference entries.
 *      Typically saves 5–25 % on scanned PDFs.
 *
 *   2. If the PDF is still above the upload threshold after re-save,
 *      extract only PAGE 1 into a brand-new PDF.
 *      This is safe because:
 *        • /api/ocr  already only reads page 1
 *        • /api/ai   vision path already slices to page 1 internally
 *        • The original full-PDF URL is always stored in the DB so users
 *          can still download the complete document from MMMUT's server.
 *
 * The caller (pipeline.ts) always passes the ORIGINAL pdf_url so the
 * database record still links to the full notice on MMMUT's site.
 */

import { PDFDocument } from 'pdf-lib';

/** Vercel free-plan hard limit — stay safely below 4.5 MB */
const UPLOAD_LIMIT_BYTES = 4.2 * 1024 * 1024;

export interface CompressResult {
  buffer: Buffer;
  originalSize: number;
  finalSize: number;
  /** How many pages the returned PDF has (1 when page-extract was needed) */
  pages: number;
  strategy: 'none' | 'resave' | 'resave+page1' | 'page1';
}

/**
 * Tries to compress `pdfBuffer` so it fits within Vercel's free-plan limit.
 * Returns the (possibly reduced) buffer together with metadata about what
 * was done.  Never throws — on any internal error it returns the original
 * buffer unchanged.
 */
export async function compressPdf(pdfBuffer: Buffer): Promise<CompressResult> {
  const originalSize = pdfBuffer.length;

  // Already small enough — nothing to do
  if (originalSize <= UPLOAD_LIMIT_BYTES) {
    return {
      buffer: pdfBuffer,
      originalSize,
      finalSize: originalSize,
      pages: -1, // unknown, not parsed
      strategy: 'none',
    };
  }

  console.log(
    `   🗜️  PDF is ${mb(originalSize)} MB — attempting compression to fit within ${mb(UPLOAD_LIMIT_BYTES)} MB limit`
  );

  // ── Strategy 1: Re-save with pdf-lib ─────────────────────────────────────
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const resaved = Buffer.from(
      await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false })
    );

    console.log(
      `   📄 Re-save result: ${mb(originalSize)} MB → ${mb(resaved.length)} MB`
    );

    if (resaved.length <= UPLOAD_LIMIT_BYTES) {
      console.log(`   ✅ Re-save was sufficient.`);
      return {
        buffer: resaved,
        originalSize,
        finalSize: resaved.length,
        pages: pdfDoc.getPageCount(),
        strategy: 'resave',
      };
    }

    // ── Strategy 2: Keep only page 1 ─────────────────────────────────────────
    console.log(
      `   📄 Re-save still too large (${mb(resaved.length)} MB). Extracting page 1 only…`
    );

    const page1Doc = await PDFDocument.create();
    const [firstPage] = await page1Doc.copyPages(pdfDoc, [0]);
    page1Doc.addPage(firstPage);
    const page1Buffer = Buffer.from(
      await page1Doc.save({ useObjectStreams: true, addDefaultPage: false })
    );

    const totalPages = pdfDoc.getPageCount();
    console.log(
      `   📄 Page-1 extract: ${mb(resaved.length)} MB → ${mb(page1Buffer.length)} MB` +
        ` (dropped ${totalPages - 1} page(s))`
    );

    if (page1Buffer.length <= UPLOAD_LIMIT_BYTES) {
      console.log(`   ✅ Page-1 extract fits within limit.`);
      return {
        buffer: page1Buffer,
        originalSize,
        finalSize: page1Buffer.length,
        pages: 1,
        strategy: 'resave+page1',
      };
    }

    // Page 1 alone is still too big — very unusual (> 4.2 MB single page)
    console.warn(
      `   ⚠️  Even page 1 is ${mb(page1Buffer.length)} MB — cannot compress below limit.`
    );
    return {
      buffer: page1Buffer, // return the smallest we managed
      originalSize,
      finalSize: page1Buffer.length,
      pages: 1,
      strategy: 'page1',
    };
  } catch (err) {
    console.error(
      `   ❌ PDF compression failed (${err instanceof Error ? err.message : err}). Using original buffer.`
    );
    return {
      buffer: pdfBuffer,
      originalSize,
      finalSize: originalSize,
      pages: -1,
      strategy: 'none',
    };
  }
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

