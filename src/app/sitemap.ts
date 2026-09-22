// sitemap.xml — Phase 17 SEO foundation.
//
// Dynamic sitemap built from current database-backed public content, using the
// lean server-only reads in lib/seo/queries (which reuse the existing public
// visibility rules) and the pure shaping in lib/seo/sitemap. Only public
// indexable content is included — never admin/auth/account/cart/checkout/
// payment, drafts, archived posts, or inactive products/categories. Filtered
// search/pagination URLs are excluded as they canonicalize to their landing
// pages. lastModified is emitted only where the data model provides a real
// date; no date is ever invented.
//
// Cached by default per the Next.js metadata-route convention; each section
// degrades to an empty list on database failure (never fake content).

import type { MetadataRoute } from "next";
import {
  getSitemapProducts,
  getSitemapCategories,
  getSitemapPosts,
  getSitemapBlogCategories,
} from "@/lib/seo/queries";
import { buildSitemap } from "@/lib/seo/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, posts, blogCategories] = await Promise.all([
    getSitemapProducts(),
    getSitemapCategories(),
    getSitemapPosts(),
    getSitemapBlogCategories(),
  ]);

  return buildSitemap({ products, categories, posts, blogCategories });
}
