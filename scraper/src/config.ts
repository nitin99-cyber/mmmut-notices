/**
 * @module config
 * Scraper configuration constants loaded from environment and CLI args.
 */

/** URL of the MMMUT notices listing page to scrape */
export const SCRAPE_URL = 'https://www.mmmut.ac.in/AllRecord' as const;

/** Supabase project URL — required env var */
export const SUPABASE_URL: string = (() => {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  return url;
})();

/** Supabase service-role key — required env var (grants admin access, keep secret) */
export const SUPABASE_SERVICE_ROLE_KEY: string = (() => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
})();

/** Maximum number of notices to process in a single run to stay within rate limits */
export const MAX_NOTICES_PER_RUN = 50;

/** When true, scraper discovers notices but skips DB writes and PDF downloads */
export const DRY_RUN: boolean = process.argv.includes('--dry-run');

/** Base URL for the Next.js API (used to trigger automated pipeline) */
export const API_BASE_URL: string = process.env.API_BASE_URL || 'https://mmmut-notices.vercel.app';
