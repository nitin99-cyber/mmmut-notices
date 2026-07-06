// Placeholder route for process-notice endpoint
// This ensures TypeScript can find the module referenced by Next.js types
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Use /api/ocr and /api/ai endpoints instead" },
    { status: 410 }
  );
}
