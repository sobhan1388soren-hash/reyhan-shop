import type { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Lazy initialization: constructing PrismaClient without a driver adapter
// throws at module-evaluation time on Prisma 7, which breaks `next build`
// when no database is reachable. Defer construction until first query so
// catalog `safe()` fallbacks can return empty results during build.
function createClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  try {
    // Adapter package may not be installed in offline envs — load lazily via
    // eval'd require so Turbopack does not try to statically resolve it.
    type AdapterModule = { PrismaPg: new (args: { connectionString: string }) => unknown };
    const load = eval("require") as (id: string) => AdapterModule;
    const adapterMod = load("@prisma/adapter-pg");
    const adapter = new adapterMod.PrismaPg({ connectionString: url });
    const options = { adapter } as unknown as ConstructorParameters<typeof Client>[0];
    return new Client(options);
  } catch {
    // Adapter package not installed (offline env) — fall through to plain
    // constructor so the error surfaces at query time inside safe().
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
