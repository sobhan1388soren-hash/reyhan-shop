import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public Supabase client for storefront (Plan B) reads. Uses the public
// anon key + URL env vars. When they are unset (e.g. a local dev box without
// a Supabase project configured), the client is `null` so callers' safe()
// wrappers degrade to empty results instead of crashing the build. The
// client is intentionally stateless (no persisted auth session).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export default supabase;
