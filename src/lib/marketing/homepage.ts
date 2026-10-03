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
import { getHeroContent, getActivePromoBanners } from "./banner-supabase.ts";
import {
  getFeaturedProducts,
  getBestSellingProducts,
  getHomepageCategories,
} from "../catalog/supabase-queries.ts";
import { getFeaturedPosts } from "../blog/blog-supabase.ts";
import {
  HOMEPAGE_PRODUCTS_TAKE,
  HOMEPAGE_POSTS_TAKE,
  type HeroContentView,
  type PromoBannerView,
} from "./banner-rules.ts";
import type { CatalogProduct } from "../catalog/types.ts";
import type { BlogPostCard } from "../blog/queries.ts";

export type HomepageCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  status: string;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
};

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
