# Supabase Database Schema

To set up your database from scratch in your new Supabase project, you need to run the following SQL script. This will create all the necessary tables for the web scraper, AI pipeline, and admin panel.

## Complete Setup Script

Copy and paste the entire script below into the **SQL Editor** in your Supabase dashboard and click **Run**.

```sql
-- 1. Create scraped_notices table (used by the GitHub Actions scraper)
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

-- 2. Create processing_jobs table (queues tasks for the AI Pipeline)
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID REFERENCES public.scraped_notices(id) ON DELETE CASCADE,
    source TEXT,
    status TEXT DEFAULT 'pending',
    current_stage TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create notices table (stores the final processed output from Gemini/Groq)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    category TEXT,
    audience TEXT[],
    summary TEXT,
    english_translation TEXT,
    important_dates JSONB DEFAULT '[]'::jsonb,
    calendar_events JSONB DEFAULT '[]'::jsonb,
    whatsapp_message TEXT,
    is_large_notice BOOLEAN DEFAULT false,
    page_count INTEGER DEFAULT 1,
    processing_method TEXT,
    pdf_url TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create system_logs table (for tracking scraper and pipeline events)
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT,
    level TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Enable Row Level Security (RLS) but allow public read for published notices
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for published notices"
ON public.notices FOR SELECT
USING (status = 'published');

-- Allow service role to bypass RLS (Supabase does this by default for the service_role key)
-- Admin Panel operations using the service_role key will succeed without explicit policies.
```

## How to Apply

1. Log in to [Supabase](https://supabase.com).
2. Select your newly created project.
3. Click on the **SQL Editor** in the left-hand navigation menu.
4. Click **New query**.
5. Paste the entire SQL block above.
6. Click **Run** (or press Cmd/Ctrl + Enter).

Once this is run, your database is fully restored and ready to receive new notices from the scraper and the admin panel!

*Note: Since you created a new project, remember to update your `.env` files locally, on Vercel, and in your GitHub Actions secrets (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) with the credentials from the new project.*