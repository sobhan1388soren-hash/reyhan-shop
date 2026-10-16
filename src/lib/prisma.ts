import type { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Normalize a raw env value into a usable connection string.
// Serverless hosts (Netlify/Vercel) sometimes inject extra whitespace,
// surrounding quotes, or stray newlines around a copied DATABASE_URL; a
// clean URL is required for both the Prisma driver adapter and the URL
// parser below to behave predictably.
function normalizeConnectionString(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  // Strip a single pair of surrounding quotes ("..." or '...').
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (value.length === 0) return null;
  // Validate it actually parses as an absolute URL. Reject junk early so the
  // caller surfaces a clear configuration error rather than a confusing
  // adapter/connection error deep inside Prisma.
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error(`unsupported scheme "${parsed.protocol}"`);
    }
  } catch (e) {
    console.error(
      `[prisma] DATABASE_URL is not a valid postgres connection string: ${(e as Error).message}`
    );
    return null;
  }
  return value;
}

/**
 * Supabase connection strings are generated with `sslmode=require`, which libpq
 * interprets as "encrypt but do NOT verify the certificate". node-postgres
 * instead treats `require` as an alias for `verify-full`, and Supabase presents a
 * self-signed certificate chain — so every connection fails with
 * "self-signed certificate in certificate chain".
 *
 * `uselibpqcompat=true` restores libpq semantics, which is Supabase's documented
 * fix for the pg/Prisma drivers. The link stays TLS-encrypted; only certificate
 * verification is relaxed. A URL that already opts out of TLS (`sslmode=disable`)
 * or already sets `uselibpqcompat` is left untouched.
 */
function applySupabaseSslCompat(url: string): string {
  const [base, query = ""] = url.split("?", 2);
  const params = new URLSearchParams(query);
  if (!params.has("sslmode") || params.get("sslmode") === "disable") return url;
  if (params.has("uselibpqcompat")) return url;
  params.set("uselibpqcompat", "true");
  return `${base}?${params.toString()}`;
}

// Lazy initialization: constructing PrismaClient without a driver adapter
// throws at module-evaluation time on Prisma 7, which breaks `next build`
// when no database is reachable. Defer construction until first query so
// catalog `safe()` fallbacks can return empty results during build.
function createClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
  const raw = normalizeConnectionString(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
  if (!raw) {
    throw new Error(
      "[prisma] DATABASE_URL is not set or invalid — configure it in the environment"
    );
  }
  const url = applySupabaseSslCompat(raw);
  try {
    // Adapter package may not be installed in offline envs — load lazily via
    // eval'd require so Turbopack does not try to statically resolve it.
    type AdapterModule = { PrismaPg: new (args: { connectionString: string }) => unknown };
    const load = eval("require") as (id: string) => AdapterModule;
    const adapterMod = load("@prisma/adapter-pg");
    const adapter = new adapterMod.PrismaPg({ connectionString: url });
    const options = { adapter } as unknown as ConstructorParameters<typeof Client>[0];
    return new Client(options);
  } catch (e) {
    // Adapter package not installed (offline env) — fall through to plain
    // constructor so the error surfaces at query time inside safe().
    console.error(
      "[prisma] @prisma/adapter-pg could not be loaded; falling back to the default engine:",
      (e as Error).message
    );
    return new Client() as PrismaClient;
  }
}

const prisma: PrismaClient =
  globalThis.prisma ??
  (new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (!globalThis.prisma) {
        globalThis.prisma = createClient();
      }
      const value = (globalThis.prisma as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(globalThis.prisma)
        : value;
    },
  }) as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  // Keep module-evaluation side-effect free; actual client cached on first use.
}

export default prisma;
