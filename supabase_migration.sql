-- Add new columns to the existing `notices` table
ALTER TABLE public.notices 
ADD COLUMN IF NOT EXISTS calendar_events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_large_notice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS processing_method TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create scraped_notices table if it doesn't exist (for the scraper)
CREATE TABLE IF NOT EXISTS public.scraped_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    pdf_url TEXT NOT NULL UNIQUE,
    source_url TEXT,
    pdf_hash TEXT UNIQUE,
    publish_date TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processing_jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID REFERENCES public.scraped_notices(id),
    source TEXT,
    status TEXT DEFAULT 'pending',
    current_stage TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT,
    level TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
