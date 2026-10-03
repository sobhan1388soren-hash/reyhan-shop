import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed-dev.mjs",
  },
  datasource: {
    // Prisma 7's config Datasource has no `directUrl` field, so the CLI
    // (migrate/db pull) resolves everything from this `url`. Point it at the
    // session pooler (DIRECT_URL) so the schema engine gets a session-capable
    // connection; the app runtime keeps using DATABASE_URL (transaction pooler)
    // via the driver adapter in src/lib/prisma.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});