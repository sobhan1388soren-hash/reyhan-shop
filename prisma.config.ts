import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

function applySupabaseSslCompat(url: string): string {
  const [base, query = ""] = url.split("?", 2);
  const params = new URLSearchParams(query);
  if (!params.has("sslmode") || params.get("sslmode") === "disable") return url;
  if (params.has("uselibpqcompat")) return url;
  params.set("uselibpqcompat", "true");
  return `${base}?${params.toString()}`;
}

const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const datasourceUrl = rawUrl ? applySupabaseSslCompat(rawUrl) : "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed-dev.mjs",
  },
  datasource: {
    url: datasourceUrl,
  },
});