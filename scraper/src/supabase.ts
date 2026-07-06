/**
 * @module supabase
 * Shared Supabase client instance configured with the service-role key.
 * Uses the service role to bypass RLS for server-side operations.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.js';

/**
 * Supabase admin client — uses the service-role key so it can
 * read/write all tables without Row-Level Security restrictions.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
