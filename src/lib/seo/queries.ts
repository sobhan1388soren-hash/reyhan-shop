// Server-only public-content reads for the sitemap — Phase 17 SEO foundation.
//
// Lean, sitemap-specific projections (slug + dates only). They deliberately
// reuse the SAME public visibility rules as the catalog/blog query layers —
// status: ACTIVE products/categories, PUBLISHED posts, ACTIVE blog categories
// — so the sitemap can never advertise content the storefront would not show.
// The rows are then shaped by the pure `./sitemap.ts` module.
//
// Failure policy mirrors the rest of the storefront: a database outage
// degrades to an empty list for that section (via `safe()`), so the sitemap
// never goes down and never invents content. No N+1: each section is a single
// findMany with a minimal select.

import "server-only";
import prisma from "../prisma.ts";
import type {
  SitemapProductRow,
  SitemapCategoryRow,
  SitemapPostRow,
} from "./sitemap.ts";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[seo] DB query failed; returning fallback:", e);
    return fallback;
  }
}

const SITEMAP_MAX = 50_000;

/** Storefront-active products (slug + updatedAt only). */
export function getSitemapProducts(): Promise<SitemapProductRow[]> {
  return safe(
    () =>
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: SITEMAP_MAX,
      }),
    []
  );
}

/** Storefront-active catalog categories (slug + updatedAt only). */
export function getSitemapCategories(): Promise<SitemapCategoryRow[]> {
  return safe(
    () =>
      prisma.category.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: SITEMAP_MAX,
      }),
    []
  );
}

/** Published blog posts (slug + publishedAt + updatedAt only). */
export function getSitemapPosts(): Promise<SitemapPostRow[]> {
  return safe(
    () =>
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, publishedAt: true, updatedAt: true },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: SITEMAP_MAX,
      }),
    []
  );
}

/** Active blog categories with at least one published post (slug + updatedAt only). */
export function getSitemapBlogCategories(): Promise<SitemapCategoryRow[]> {
  return safe(async () => {
    const [categories, postedCategoryIds] = await Promise.all([
      prisma.postCategory.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: SITEMAP_MAX,
      }),
      prisma.postCategoryRelation.findMany({
        where: { post: { status: "PUBLISHED" } },
        select: { categoryId: true },
        distinct: ["categoryId"],
      }),
    ]);
    const withPosts = new Set(postedCategoryIds.map((row) => row.categoryId));
    return categories
      .filter((category) => withPosts.has(category.id))
      .map((category) => ({ slug: category.slug, updatedAt: category.updatedAt }));
  }, []);
}
