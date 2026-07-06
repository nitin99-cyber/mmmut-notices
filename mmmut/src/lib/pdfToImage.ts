import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { createCanvas } from "canvas";

// Ensure standard fonts are loaded if needed (optional for basic notices)
pdfjsLib.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/legacy/build/pdf.worker.entry.js");

/**
 * Converts the first page of a PDF buffer into a base64 PNG image.
 * Uses pdf.js and node-canvas to render the PDF server-side.
 * 
 * @param pdfBuffer The raw PDF file buffer
 * @returns Base64 encoded PNG string (without data URI prefix)
 */
export async function convertPdfToImageBase64(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });
    
    const pdfDocument = await loadingTask.promise;
    
    // We only need the first page for the Groq fallback
    const page = await pdfDocument.getPage(1);
    
    // Use a reasonable scale for AI reading (1.5 - 2.0 is usually enough)
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    
    // Render PDF page into canvas context
    await page.render({
      canvasContext: context as any,
      viewport: viewport,
    }).promise;
    
    // Extract base64 without the 'data:image/png;base64,' prefix
    const base64Image = canvas.toDataURL("image/png").split(",")[1];
    return base64Image;
  } catch (error) {
    console.error("PDF to Image conversion failed:", error);
    throw new Error("Failed to convert PDF to image for Groq Vision fallback.");
  }
}
