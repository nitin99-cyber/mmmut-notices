import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Public client — for browser / client components.
 * Created lazily to avoid crashing when env vars are not set yet.
 */
let _publicClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_publicClient) return _publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }

  _publicClient = createClient(url, key);
  return _publicClient;
}

/**
 * Server client — uses service role key.
 * Only call this inside API routes / server components.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }

  return createClient(url, key);
}