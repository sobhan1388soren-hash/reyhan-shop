import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public Supabase client for storefront (Plan B) reads. Uses the public
// URL + a public key. Two key env names are accepted:
//   - NEXT_PUBLIC_SUPABASE_ANON_KEY          (legacy JWT anon key)
//   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (newer Supabase publishable key)
// Both are public-by-design (RLS-protected) and safe to expose to the client.
//
// When env vars are missing or malformed (e.g. a preview deploy without the
// project configured, or a placeholder value pasted into a dashboard), the
// client is `null` so callers' safe() wrappers degrade to their fallbacks
// instead of crashing the build or throwing a 500 at render time.
// The client is intentionally stateless (no persisted auth session).

function isValidSupabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  if (isValidSupabaseUrl(supabaseUrl)) {
    try {
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (e) {
      // Defensive: createClient validates inputs and can throw on malformed
      // values — a misconfigured deploy must degrade, never crash rendering.
      console.error("[supabase] client creation failed; storefront reads will use fallbacks:", e);
      supabase = null;
    }
  } else {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL; storefront reads will use fallbacks.");
  }
}

/** True when a usable Supabase client exists (env vars present + valid). */
export const isSupabaseConfigured = supabase !== null;

export default supabase;
