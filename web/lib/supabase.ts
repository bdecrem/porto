import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Server-only Supabase client using the service role key. Never import this
// from a "use client" file. The service role bypasses RLS — every table in
// Feynd v1 has RLS on with no policies, so this is the only path that can
// read or write the feynd_v1_* tables.
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not set. Need SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local or Vercel env.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
