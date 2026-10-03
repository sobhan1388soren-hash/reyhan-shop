// Homepage data assembly — Phase 16.
//
// Server-only, single round-trip-friendly composition of everything the
// storefront homepage renders. Each constituent query already degrades
// safely to an empty result / factual defaults via its own `safe()`
// wrapper, so a database outage can never take the homepage down and no
// fake content is ever substituted.
//
// Reuse policy (no parallel systems):
//   - hero/promos  → the banner service (banner-service.ts)
//   - featured     → catalog getFeaturedProducts (admin isFeatured flag)
//   - best-selling → catalog getBestSellingProducts (real order data)
//   - posts        → the public blog queries (PUBLISHED only)
//   - categories   → the catalog category tree, top-level subset only

import "server-only";
import prisma from "@/lib/prisma";
import {
  getHeroContent,
  getActivePromoBanners,
} from "./banner-service.ts";
import {
  getFeaturedProducts,
  getBestSellingProducts,
} from "../catalog/queries.ts";
import { getFeaturedPosts } from "../blog/queries.ts";
import {
  HOMEPAGE_CATEGORIES_TAKE,
  HOMEPAGE_PRODUCTS_TAKE,
  HOMEPAGE_POSTS_TAKE,
  type HeroContentView,
  type PromoBannerView,
} from "./banner-rules.ts";
import type { CatalogCategory, CatalogProduct } from "../catalog/types.ts";
import type { BlogPostCard } from "../blog/queries.ts";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[homepage] DB query failed; returning fallback:", e);
    return fallback;
  }
}

export type HomepageCategory = CatalogCategory & {
  /** Active products assigned directly to this category (real count). */
  productCount: number;
};

/**
 * Top-level ACTIVE categories only — the curated homepage subset (never
 * the whole tree). Product counts come from a single groupBy over the
 * existing ProductCategory link table; an unreachable DB → empty list.
 */
export async function getHomepageCategories(
  take: number = HOMEPAGE_CATEGORIES_TAKE
): Promise<HomepageCategory[]> {
  return safe(async () => {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({
        where: { status: "ACTIVE", parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take,
      }),
      prisma.productCategory.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        where: { product: { status: "ACTIVE" } },
      }),
    ]);

    const countById = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      parentId: c.parentId,
      level: c.level,
      status: c.status,
      sortOrder: c.sortOrder,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      productCount: countById.get(c.id) ?? 0,
    }));
  }, []);
}

export type HomepageData = {
  hero: HeroContentView;
  promos: PromoBannerView[];
  categories: HomepageCategory[];
  featured: CatalogProduct[];
  bestSelling: CatalogProduct[];
  posts: BlogPostCard[];
};

/**
 * Everything the homepage needs, fetched in parallel. Sections whose data
 * is missing simply render nothing (or the factual hero defaults) — never
 * placeholders presented as real content.
 */
export async function getHomepageData(): Promise<HomepageData> {
  const [hero, promos, categories, featured, bestSelling, posts] = await Promise.all([
    getHeroContent(),
    getActivePromoBanners(),
    getHomepageCategories(),
    getFeaturedProducts(HOMEPAGE_PRODUCTS_TAKE),
    getBestSellingProducts(HOMEPAGE_PRODUCTS_TAKE),
    getFeaturedPosts(HOMEPAGE_POSTS_TAKE),
  ]);

  return { hero, promos, categories, featured, bestSelling, posts };
}
