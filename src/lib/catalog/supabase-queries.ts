import { cache } from "react";
import supabase from "@/lib/supabase";
import {
  getFallbackBestSellingProducts,
  getFallbackCategoryBySlug,
  getFallbackCategoryTree,
  getFallbackFeaturedProducts,
  getFallbackHomepageCategories,
  getFallbackProductBySlug,
  getFallbackRelatedProducts,
} from "./fallback";
import type {
  CatalogProduct,
  CatalogCategory,
  AvailabilityState,
  PriceRange,
  CatalogSpecification,
  CatalogImage,
} from "./types";
import type { OrderStatus } from "@prisma/client";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("[catalog.supabase] query failed; returning fallback:", e);
    return fallback;
  }
}

/**
 * Resilience policy for display surfaces: when the database is unreachable
 * (missing/invalid env, network failure) or a list query returns empty rows,
 * the static real-catalog snapshot (./fallback) is served instead of an empty
 * storefront. Single-record lookups only use the snapshot when the database
 * itself was unreachable — a genuinely absent slug on a healthy database is
 * still a real "not found".
 */
async function safeList<T>(
  isEmpty: (v: T) => boolean,
  fn: () => Promise<T>,
  snapshot: () => T
): Promise<T> {
  if (!supabase) return snapshot();
  try {
    const result = await fn();
    return isEmpty(result) ? snapshot() : result;
  } catch (e) {
    console.error("[catalog.supabase] query failed; serving static catalog snapshot:", e);
    return snapshot();
  }
}

function toAvailabilityState(
  status: string,
  variants: {
    isActive: boolean;
    inventory: {
      quantity: number;
      reservedQuantity: number;
      lowStockThreshold: number;
    } | null;
  }[]
): AvailabilityState {
  if (status !== "ACTIVE") return "unavailable";
  const active = variants.filter((v) => v.isActive);
  if (!active.length) return "unavailable";
  const totalQty = active.reduce(
    (sum, v) =>
      sum + (v.inventory?.quantity ?? 0) - (v.inventory?.reservedQuantity ?? 0),
    0
  );
  if (totalQty <= 0) return "out_of_stock";
  const lowStock = active.some(
    (v) =>
      v.inventory &&
      v.inventory.quantity - v.inventory.reservedQuantity <=
        (v.inventory.lowStockThreshold ?? 5)
  );
  if (lowStock) return "low_stock";
  return "in_stock";
}

function toCatalogProductView(row: Record<string, unknown>): CatalogProduct {
  const variants = ((row.variants as Record<string, unknown>[]) ?? []).map((v) => ({
    id: v.id as string,
    title: v.title as string,
    sku: v.sku as string,
    price: v.price as number,
    compareAtPrice: v.compareAtPrice as number | null,
    isActive: v.isActive as boolean,
    isDefault: v.isDefault as boolean,
    inventory: v.inventory as {
      quantity: number;
      reservedQuantity: number;
      lowStockThreshold: number;
    } | null,
  }));

  const prices = variants.filter((v) => v.isActive).map((v) => v.price);
  const priceRange: PriceRange = {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
  };

  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string | null,
    shortDescription: row.shortDescription as string | null,
    status: row.status as string,
    isFeatured: row.isFeatured as boolean,
    seoTitle: row.seoTitle as string | null,
    seoDescription: row.seoDescription as string | null,
    categories: ((row.categories as Array<{ category: { id: string; name: string; slug: string } }>) ?? []).map(c => c.category),
    variants,
    specifications: (row.specifications as CatalogSpecification[]) ?? [],
    images: (row.images as CatalogImage[]) ?? [],
    availability: toAvailabilityState(row.status as string, variants),
    priceRange,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

async function fetchProductWithRelations(
  id?: string,
  slug?: string
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const query = supabase
    .from("products")
    .select(`
      id, title, slug, description, shortDescription, status, isFeatured,
      seoTitle, seoDescription, createdAt, updatedAt,
      variants:product_variants(id, title, sku, price, compareAtPrice, isActive, isDefault, sortOrder,
        inventory:inventories(quantity, reservedQuantity, lowStockThreshold)),
      specifications:product_specifications(key, value, sortOrder),
      images:product_images(url, alt, sortOrder),
      categories:product_categories(category:categories(id, name, slug))
    `)
    .limit(1);

  if (id) query.eq("id", id);
  else if (slug) query.eq("slug", slug);
  else return null;

  const { data, error } = await query;
  // Throw on transport/RLS errors so safe() serves the static snapshot;
  // an empty result on a healthy database stays a real "not found".
  if (error) throw error;
  if (!data?.length) return null;
  return data[0] as Record<string, unknown>;
}

export const getProductBySlug = cache(async (slug: string): Promise<CatalogProduct | null> => {
  // Snapshot only when the database itself is unreachable; a healthy
  // database returning no row is a real "not found" (null).
  if (!supabase) return getFallbackProductBySlug(slug);
  return safe(async () => {
    const row = await fetchProductWithRelations(undefined, slug);
    if (!row) return null;
    return toCatalogProductView(row);
  }, getFallbackProductBySlug(slug));
});

export async function getFeaturedProducts(take = 8): Promise<CatalogProduct[]> {
  return safeList(
    (list) => list.length === 0,
    async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, title, slug, description, shortDescription, status, isFeatured,
          seoTitle, seoDescription, createdAt, updatedAt,
          variants:product_variants(id, title, sku, price, compareAtPrice, isActive, isDefault, sortOrder,
            inventory:inventories(quantity, reservedQuantity, lowStockThreshold)),
          specifications:product_specifications(key, value, sortOrder),
          images:product_images(url, alt, sortOrder),
          categories:product_categories(category:categories(id, name, slug))
        `)
        .eq("isFeatured", true)
        .eq("status", "ACTIVE")
        .order("updatedAt", { ascending: false })
        .limit(take);

      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(toCatalogProductView);
    },
    () => getFallbackFeaturedProducts(take)
  );
}

const VALID_SALE_ORDER_STATUS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

export async function getBestSellingProducts(take = 8): Promise<CatalogProduct[]> {
  return safeList(
    (list) => list.length === 0,
    async () => {
      if (!supabase) return [];
      const { data: orderItems, error: oiError } = await supabase
        .from("order_items")
        .select("productId, quantity")
        .in(
          "order.status",
          VALID_SALE_ORDER_STATUS.map((s) => s)
        )
        .eq("order.paymentStatus", "PAID");

      if (oiError || !orderItems) return [];

    const quantityByProduct = new Map<string, number>();
    for (const item of orderItems) {
      const current = quantityByProduct.get(item.productId) ?? 0;
      quantityByProduct.set(item.productId, current + item.quantity);
    }

    const sorted = [...quantityByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, take)
      .map(([productId]) => productId);

      if (!sorted.length) return [];

      if (!supabase) return [];
      const { data: products, error: pError } = await supabase
        .from("products")
        .select(`
          id, title, slug, description, shortDescription, status, isFeatured,
          seoTitle, seoDescription, createdAt, updatedAt,
          variants:product_variants(id, title, sku, price, compareAtPrice, isActive, isDefault, sortOrder,
            inventory:inventories(quantity, reservedQuantity, lowStockThreshold)),
          specifications:product_specifications(key, value, sortOrder),
          images:product_images(url, alt, sortOrder),
          categories:product_categories(category:categories(id, name, slug))
        `)
        .in("id", sorted)
        .eq("status", "ACTIVE");

      if (pError || !products) return [];

      const productMap = new Map(
        (products as Record<string, unknown>[]).map((p) => [p.id as string, p])
      );

      return sorted
        .map((id) => productMap.get(id))
        .filter(Boolean)
        .map((p) => toCatalogProductView(p!));
    },
    () => getFallbackBestSellingProducts(take)
  );
}

export async function getCategoryBySlug(
  slug: string
): Promise<CatalogCategory | null> {
  if (!supabase) return getFallbackCategoryBySlug(slug);
  return safe(async () => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, image, parentId, level, status, sortOrder, seoTitle, seoDescription")
      .eq("slug", slug)
      .single();

    if (error || !data) return null;
    return data as unknown as CatalogCategory;
  }, getFallbackCategoryBySlug(slug));
}

export async function getCategoryTree(): Promise<CatalogCategory[]> {
  return safeList(
    (list) => list.length === 0,
    async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, image, parentId, level, status, sortOrder, seoTitle, seoDescription")
        .eq("status", "ACTIVE")
        .order("sortOrder", { ascending: true })
        .order("name", { ascending: true });

      if (error || !data) return [];
      return data as unknown as CatalogCategory[];
    },
    () => getFallbackCategoryTree()
  );
}

export async function getHomepageCategories(take = 6) {
  return safeList(
    (list) => list.length === 0,
    async () => {
      if (!supabase) return [];
      const [categories, { data: productCounts }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, description, image, parentId, level, status, sortOrder, seoTitle, seoDescription")
          .eq("status", "ACTIVE")
          .is("parentId", null)
          .order("sortOrder", { ascending: true })
          .order("name", { ascending: true })
          .limit(take),
        supabase
          .from("product_categories")
          .select("categoryId")
          .eq("product.status", "ACTIVE"),
      ]);

      const cats = (categories.data ?? []) as unknown as CatalogCategory[];
      const countById = new Map<string, number>();
      if (productCounts) {
        for (const pc of productCounts as { categoryId: string }[]) {
          countById.set(pc.categoryId, (countById.get(pc.categoryId) ?? 0) + 1);
        }
      }

      return cats.map((c) => ({
        ...c,
        productCount: countById.get(c.id) ?? 0,
      }));
    },
    () => getFallbackHomepageCategories(take)
  );
}

export async function getRelatedProducts(
  productId: string,
  categoryIds: string[],
  take = 4
): Promise<CatalogProduct[]> {
  return safeList(
    (list) => list.length === 0,
    async () => {
      if (!supabase) return [];
      if (!categoryIds.length) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          id, title, slug, description, shortDescription, status, isFeatured,
          seoTitle, seoDescription, createdAt, updatedAt,
          variants:product_variants(id, title, sku, price, compareAtPrice, isActive, isDefault, sortOrder,
            inventory:inventories(quantity, reservedQuantity, lowStockThreshold)),
          specifications:product_specifications(key, value, sortOrder),
          images:product_images(url, alt, sortOrder),
          categories:product_categories(category:categories(id, name, slug))
        `)
        .eq("status", "ACTIVE")
        .neq("id", productId)
        .in("product_categories.categoryId", categoryIds)
        .order("createdAt", { ascending: false })
        .limit(take);

      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(toCatalogProductView);
    },
    () => getFallbackRelatedProducts(productId, categoryIds, take)
  );
}
