// Static storefront catalog snapshot — resilience layer for display surfaces.
//
// This is NOT invented mock content: it is derived 1:1 from the store's real
// catalog seed (`scripts/data/reyhan-catalog.json`, the same source
// `npm run ingest` pushes into the database). Titles, prices, stock and
// descriptions are the store's actual catalog facts. It exists so display-only
// surfaces (homepage, featured strip, category tree) can still render the real
// catalog when the database is unreachable, env vars are missing on a deploy
// target, or tables transiently return empty rows — instead of 500s or a
// silently empty storefront.
//
// Rules:
//   - Placeholder image URLs (ingest scaffolding on *.example.com) are
//     stripped; components render their branded no-image visual instead.
//   - Transactional paths (cart, checkout, orders, payments, admin) NEVER read
//     from this module — they keep their honest empty/error states.
//   - Synthetic ids are prefixed `fb-` so snapshot rows are always
//     distinguishable from database rows in logs and caches.

import rawCatalog from "../../../scripts/data/reyhan-catalog.json";
import type {
  AvailabilityState,
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  PriceRange,
} from "./types";

type RawCategory = (typeof rawCatalog)["categories"][number];
type RawProduct = (typeof rawCatalog)["products"][number];
type RawVariant = NonNullable<RawProduct["variants"]>[number];

function realImageUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Ingest scaffolding hosts are not real media.
    if (u.hostname.toLowerCase().endsWith(".example.com")) return null;
    return url;
  } catch {
    return null;
  }
}

function toAvailability(status: string, variants: CatalogVariant[]): AvailabilityState {
  if (status !== "ACTIVE") return "unavailable";
  const active = variants.filter((v) => v.isActive);
  if (!active.length) return "unavailable";
  const totalQty = active.reduce(
    (sum, v) => sum + (v.inventory?.quantity ?? 0) - (v.inventory?.reservedQuantity ?? 0),
    0
  );
  if (totalQty <= 0) return "out_of_stock";
  const low = active.some(
    (v) =>
      v.inventory &&
      v.inventory.quantity - v.inventory.reservedQuantity <= v.inventory.lowStockThreshold
  );
  return low ? "low_stock" : "in_stock";
}

function toDate(value: unknown): Date {
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return new Date(t);
  }
  return new Date(0);
}

function toFallbackCategory(raw: RawCategory): CatalogCategory {
  return {
    id: `fb-cat-${raw.slug}`,
    name: raw.name,
    slug: raw.slug,
    description: raw.description ?? null,
    image: realImageUrl(raw.image),
    parentId: raw.parentSlug ? `fb-cat-${raw.parentSlug}` : null,
    level: typeof raw.level === "number" ? raw.level : 0,
    status: raw.status ?? "ACTIVE",
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
    seoTitle: raw.seoTitle ?? null,
    seoDescription: raw.seoDescription ?? null,
  };
}

function toFallbackVariant(raw: RawVariant, productSlug: string, index: number): CatalogVariant {
  const quantity = typeof raw.quantity === "number" ? Math.max(0, raw.quantity) : 0;
  return {
    id: `fb-var-${raw.sku ?? `${productSlug}-${index}`}`,
    title: raw.title,
    sku: raw.sku ?? `FB-${productSlug}-${index}`,
    price: typeof raw.price === "number" ? raw.price : 0,
    compareAtPrice: typeof raw.compareAtPrice === "number" ? raw.compareAtPrice : null,
    isActive: raw.isActive ?? true,
    isDefault: raw.isDefault ?? index === 0,
    inventory: {
      quantity,
      reservedQuantity: 0,
      lowStockThreshold:
        typeof raw.lowStockThreshold === "number" ? raw.lowStockThreshold : 5,
    },
  };
}

const FALLBACK_CATEGORIES: CatalogCategory[] = (rawCatalog.categories ?? []).map(
  toFallbackCategory
);

const CATEGORY_BY_SLUG = new Map(FALLBACK_CATEGORIES.map((c) => [c.slug, c]));

function toFallbackProduct(raw: RawProduct): CatalogProduct {
  const variants = (raw.variants ?? []).map((v, i) => toFallbackVariant(v, raw.slug, i));
  const prices = variants.filter((v) => v.isActive).map((v) => v.price);
  const priceRange: PriceRange = {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
  };
  const createdAt = toDate(raw.publishedAt);
  return {
    id: `fb-prod-${raw.slug}`,
    title: raw.title,
    slug: raw.slug,
    description: raw.description ?? null,
    shortDescription: raw.shortDescription ?? null,
    status: raw.status ?? "ACTIVE",
    isFeatured: raw.isFeatured ?? false,
    seoTitle: raw.seoTitle ?? null,
    seoDescription: raw.seoDescription ?? null,
    categories: (raw.categorySlugs ?? [])
      .map((slug) => CATEGORY_BY_SLUG.get(slug))
      .filter((c): c is CatalogCategory => c != null)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    variants,
    specifications: (raw.specifications ?? []).map((s) => ({
      key: s.key,
      value: s.value,
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : 0,
    })),
    images: (raw.images ?? []).flatMap((img) => {
      const url = realImageUrl(img?.url);
      return url ? [{ url, alt: img?.alt ?? null }] : [];
    }),
    availability: toAvailability(raw.status ?? "ACTIVE", variants),
    priceRange,
    createdAt,
    updatedAt: createdAt,
  };
}

const FALLBACK_PRODUCTS: CatalogProduct[] = (rawCatalog.products ?? [])
  .map(toFallbackProduct)
  .filter((p) => p.status === "ACTIVE");

/** Featured strip — real products flagged isFeatured in the catalog seed. */
export function getFallbackFeaturedProducts(take = 8): CatalogProduct[] {
  const featured = FALLBACK_PRODUCTS.filter((p) => p.isFeatured);
  const list = featured.length ? featured : FALLBACK_PRODUCTS;
  return list.slice(0, Math.max(1, take));
}

/**
 * Best-selling proxy — the snapshot has no order rows, so the flagship
 * (isFeatured) products stand in. Sales numbers are never displayed, so no
 * fake ranking claims are made; the section simply keeps rendering real items.
 */
export function getFallbackBestSellingProducts(take = 8): CatalogProduct[] {
  return getFallbackFeaturedProducts(take);
}

/** Top-level categories with real per-category product counts. */
export function getFallbackHomepageCategories(
  take = 6
): (CatalogCategory & { productCount: number })[] {
  const countBySlug = new Map<string, number>();
  for (const p of FALLBACK_PRODUCTS) {
    for (const c of p.categories) {
      countBySlug.set(c.slug, (countBySlug.get(c.slug) ?? 0) + 1);
    }
  }
  return FALLBACK_CATEGORIES.filter((c) => c.parentId === null && c.status === "ACTIVE")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fa"))
    .slice(0, Math.max(1, take))
    .map((c) => ({ ...c, productCount: countBySlug.get(c.slug) ?? 0 }));
}

/** Full category tree (children nested) — mirrors getCategoryTree's shape. */
export function getFallbackCategoryTree(): CatalogCategory[] {
  const byId = new Map<string, CatalogCategory & { children: CatalogCategory[] }>();
  const active = FALLBACK_CATEGORIES.filter((c) => c.status === "ACTIVE");
  for (const c of active) byId.set(c.id, { ...c, children: [] });
  const roots: (CatalogCategory & { children: CatalogCategory[] })[] = [];
  for (const c of byId.values()) {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (parent) parent.children!.push(c);
    else roots.push(c);
  }
  const sortFn = (a: CatalogCategory, b: CatalogCategory) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fa");
  roots.sort(sortFn);
  for (const c of byId.values()) c.children!.sort(sortFn);
  return roots;
}

export function getFallbackCategoryBySlug(slug: string): CatalogCategory | null {
  return CATEGORY_BY_SLUG.get(slug) ?? null;
}

export function getFallbackProductBySlug(slug: string): CatalogProduct | null {
  return FALLBACK_PRODUCTS.find((p) => p.slug === slug) ?? null;
}

/** Related strip — same-category real products first, then other catalog items. */
export function getFallbackRelatedProducts(
  productId: string,
  categoryIds: string[],
  take = 4
): CatalogProduct[] {
  const wanted = new Set(categoryIds);
  const sameCategory = FALLBACK_PRODUCTS.filter(
    (p) => p.id !== productId && p.categories.some((c) => wanted.has(c.id))
  );
  const rest = FALLBACK_PRODUCTS.filter(
    (p) => p.id !== productId && !sameCategory.includes(p)
  );
  return [...sameCategory, ...rest].slice(0, Math.max(1, take));
}
