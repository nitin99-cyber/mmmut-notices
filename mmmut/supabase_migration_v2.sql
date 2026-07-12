-- ═══════════════════════════════════════════════════════
-- MMMUT Notice Platform — Migration v2
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add pipeline_log and sent columns to notices table
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_log JSONB DEFAULT NULL;

-- pipeline_log stores the full AI pipeline track record:
-- {
--   "ocr_method": "easyocr",
--   "ocr_confidence": 87,
--   "ocr_char_count": 1240,
--   "ai_model": "Gemini",
--   "processing_method": "gemini_text",
--   "decision_reason": "OCR confidence above threshold",
--   "stages": [
--     { "name": "Upload PDF", "status": "done", "detail": "notice.pdf", "timestamp": "..." },
--     { "name": "OCR Processing", "status": "done", "detail": "87% confidence", "timestamp": "..." },
--     { "name": "Decision Engine", "status": "done", "detail": "→ Text Path", "timestamp": "..." },
--     { "name": "AI Processing (Gemini)", "status": "done", "detail": "gemini_text · Fee · 2 groups", "timestamp": "..." },
--     { "name": "Save to Database", "status": "done", "detail": "Saved · ID: ...", "timestamp": "..." }
--   ]
-- }

-- 2. Create deadlines table
CREATE TABLE IF NOT EXISTS public.deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    category TEXT DEFAULT 'other' CHECK (category IN ('fee', 'exam', 'registration', 'other')),
    email_sent BOOLEAN DEFAULT false,
    whatsapp_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS Policies for deadlines (allow all for now — restrict later)
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all for deadlines" ON public.deadlines
    FOR ALL USING (true);

-- 4. RLS update for notices sent column
-- (existing notices table should already have RLS; just ensure sent column is accessible)

-- 5. Helpful index for deadline queries
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON public.deadlines(date ASC);
CREATE INDEX IF NOT EXISTS idx_notices_sent ON public.notices(sent);
CREATE INDEX IF NOT EXISTS idx_notices_created ON public.notices(created_at DESC);
