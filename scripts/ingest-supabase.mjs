// Reyhan catalog ingest (Phase 21 — Data Ingestion) via the official
// Supabase JS SDK (Plan B). Reads scripts/data/reyhan-catalog.json, upserts
// categories/products/variants/inventories/images/specifications/banners.
//
// Idempotent via upsert on unique keys (slug / sku / composite PKs). No
// destructive deletes; never touches users/orders/payments/reviews.
//
// Image policy: URL-only (https:// or root-relative). NO upload to storage.
//
// Usage:
//   node scripts/ingest-supabase.mjs [path-to-json]
// Requires env (in .env):
//   NEXT_PUBLIC_SUPABASE_URL   — project URL
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (writes); NEVER ship to client.
//                                 (or SUPABASE_ANON_KEY for reads-only runs)
//
// It fails fast when the client or env is missing — it never "succeeds"
// silently on a missing backend.

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (check .env)");
  const key = serviceKey ?? anonKey;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (check .env)");
  return { url, key, isServiceRole: Boolean(serviceKey) };
}

const { createClient } = await import("@supabase/supabase-js");
const { url, key, isServiceRole } = loadSupabase();
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DATA_PATH =
  process.argv[2] ??
  join(__dirname, "data", "reyhan-catalog.json");

const data = JSON.parse(await readFile(DATA_PATH, "utf8"));

async function upsert(table, rows, onConflict) {
  if (!rows?.length) return { inserted: 0, matched: 0 };
  const { data: result, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict, ignoreDuplicates: false });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  return { result: result ?? [], count: rows.length };
}

console.log(`[ingest] role=${isServiceRole ? "SERVICE_ROLE" : "ANON"} — url=${url}`);
console.log(`[ingest] data file: ${DATA_PATH}`);
console.log(
  `[ingest] categories=${data.categories?.length ?? 0}, products=${data.products?.length ?? 0}, banners=${data.banners?.length ?? 0}`
);

const categoryBySlug = new Map();
let catCreated = 0, catMatched = 0;

for (const cat of (data.categories ?? [])) {
  let parentId = null;
  if (cat.parentSlug) {
    const parent = categoryBySlug.get(cat.parentSlug);
    if (!parent) throw new Error(`Parent category missing for ${cat.slug} -> ${cat.parentSlug}`);
    parentId = parent.id;
  }

  const exists = await supabase
    .from("categories")
    .select("id")
    .eq("slug", cat.slug)
    .maybeSingle();

  const row = {
    name: cat.name,
    slug: cat.slug,
    description: cat.description ?? null,
    image: cat.image ?? null,
    sortOrder: cat.sortOrder ?? 0,
    level: cat.level ?? 0,
    status: cat.status ?? "ACTIVE",
    seoTitle: cat.seoTitle ?? null,
    seoDescription: cat.seoDescription ?? null,
    ...(parentId ? { parentId } : { parentId: null }),
  };

  const { data: created, error } = await supabase
    .from("categories")
    .upsert(row, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (error) throw new Error(`category upsert failed for ${cat.slug}: ${error.message}`);
  categoryBySlug.set(cat.slug, created);
  if (exists.data) catMatched++;
  else catCreated++;
}

console.log(`[ingest] categories — created: ${catCreated}, matched: ${catMatched}`);

let prodCreated = 0, prodMatched = 0;

for (const p of (data.products ?? [])) {
  const existingProduct = await supabase
    .from("products")
    .select("id")
    .eq("slug", p.slug)
    .maybeSingle();

  const categoryIds = [];
  for (const slug of p.categorySlugs ?? []) {
    const cat = categoryBySlug.get(slug);
    if (!cat) throw new Error(`Category ${slug} not found for product ${p.slug}`);
    categoryIds.push(cat.id);
  }

  const productRow = {
    title: p.title,
    slug: p.slug,
    description: p.description ?? null,
    shortDescription: p.shortDescription ?? null,
    status: p.status ?? "ACTIVE",
    isFeatured: p.isFeatured ?? false,
    publishedAt: p.publishedAt ?? null,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
    seoKeywords: p.seoKeywords ?? null,
  };

  const { data: product, error: pErr } = await supabase
    .from("products")
    .upsert(productRow, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (pErr) throw new Error(`product upsert failed for ${p.slug}: ${pErr.message}`);
  if (existingProduct.data) prodMatched++;
  else prodCreated++;

  for (const catId of categoryIds) {
    const { error: linkErr } = await supabase
      .from("product_categories")
      .upsert({ productId: product.id, categoryId: catId }, { onConflict: "productId,categoryId" });
    if (linkErr) throw new Error(`product_category link failed: ${linkErr.message}`);
  }

  for (const v of p.variants ?? []) {
    const existingVariant = await supabase
      .from("product_variants")
      .select("id")
      .eq("sku", v.sku)
      .maybeSingle();

    const variantRow = {
      productId: product.id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode ?? null,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      costPrice: v.costPrice ?? null,
      weight: v.weight ?? null,
      isDefault: v.isDefault ?? false,
      isActive: v.isActive ?? true,
      sortOrder: v.sortOrder ?? 0,
    };

    const { data: variant, error: vErr } = await supabase
      .from("product_variants")
      .upsert(variantRow, { onConflict: "sku" })
      .select("id, sku")
      .single();

    if (vErr) throw new Error(`variant upsert failed for ${v.sku}: ${vErr.message}`);

    const invRow = {
      variantId: variant.id,
      quantity: v.quantity ?? 0,
      reservedQuantity: 0,
      lowStockThreshold: v.lowStockThreshold ?? 5,
    };
    const { error: invErr } = await supabase
      .from("inventories")
      .upsert(invRow, { onConflict: "variantId" });
    if (invErr) throw new Error(`inventory upsert failed for ${v.sku}: ${invErr.message}`);

    for (const img of p.images ?? []) {
      const { error: imgErr } = await supabase
        .from("product_images")
        .upsert(
          {
            productId: product.id,
            variantId: v.isDefault ? null : variant.id,
            url: img.url,
            alt: img.alt ?? p.title,
            sortOrder: img.sortOrder ?? 0,
          },
          { onConflict: "url,productId" }
        );
      if (imgErr && !/duplicate key|unique violation/i.test(imgErr.message)) {
        throw new Error(`image upsert failed: ${imgErr.message}`);
      }
    }
  }

  for (const spec of p.specifications ?? []) {
    const { error: specErr } = await supabase
      .from("product_specifications")
      .upsert(
        {
          productId: product.id,
          key: spec.key,
          value: spec.value,
          sortOrder: spec.sortOrder ?? 0,
        },
        { onConflict: "productId,key" }
      );
    if (specErr) throw new Error(`spec upsert failed for ${spec.key}: ${specErr.message}`);
  }
}

console.log(`[ingest] products — created: ${prodCreated}, matched: ${prodMatched}`);

for (const b of data.banners ?? []) {
  const { error } = await supabase
    .from("banners")
    .upsert(
      {
        placement: b.placement,
        title: b.title,
        description: b.description ?? null,
        imageUrl: b.imageUrl ?? null,
        primaryLinkHref: b.primaryLinkHref ?? null,
        primaryLinkLabel: b.primaryLinkLabel ?? null,
        secondaryLinkHref: b.secondaryLinkHref ?? null,
        secondaryLinkLabel: b.secondaryLinkLabel ?? null,
        isActive: b.isActive ?? false,
        sortOrder: b.sortOrder ?? 0,
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`banner upsert failed: ${error.message}`);
}

console.log(`[ingest] banners — ${data.banners?.length ?? 0} upserted`);

const { data: counts, error: cErr } = await supabase
  .from("products")
  .select("id", { count: "exact", head: true });
if (cErr) throw new Error(`verification count failed: ${cErr.message}`);
const { count } = await supabase
  .from("products")
  .select("id", { count: "exact", head: true })
  .eq("status", "ACTIVE");
console.log(`[ingest] verification — total products: ${counts?.length ?? 0}, ACTIVE: ${count}`);

console.log("[ingest] Done — idempotent, no destructive deletes.");
