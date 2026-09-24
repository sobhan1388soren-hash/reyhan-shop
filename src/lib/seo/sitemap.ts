// Sitemap shaping — Phase 17 SEO foundation.
//
// Pure, DB-free transformation from already-fetched public content rows into
// Next.js `MetadataRoute.Sitemap` entries. The actual database reads live in
// the server-only `./queries.ts` (which reuses the existing public visibility
// rules: ACTIVE products/categories, PUBLISHED posts, ACTIVE blog categories);
// nothing here touches Prisma, so the inclusion/exclusion logic and canonical
// URL construction are unit-testable in a bare `node --test` process.
//
// Inclusion policy:
//   - homepage, /products, /categories, /blog landing pages
//   - ACTIVE products, ACTIVE catalog categories
//   - PUBLISHED blog posts, ACTIVE blog categories
//   - NEVER: admin, auth, account, cart, checkout, payment, drafts,
//     archived/inactive content, or filtered/search/pagination URLs.
//
// lastModified is only emitted where the data model provides a reliable date
// (products/categories/posts carry updatedAt; posts carry publishedAt). No
// date is ever invented.

import type { MetadataRoute } from "next";
import { canonicalUrl } from "./site.ts";
import {
  productPath,
  categoryPath,
  blogPostPath,
  blogCategoryPath,
} from "./json-ld.ts";

export type SitemapProductRow = { slug: string; updatedAt?: Date | null };
export type SitemapCategoryRow = { slug: string; updatedAt?: Date | null };
export type SitemapPostRow = { slug: string; publishedAt?: Date | null; updatedAt?: Date | null };

export type SitemapInput = {
  products?: SitemapProductRow[];
  categories?: SitemapCategoryRow[];
  posts?: SitemapPostRow[];
  blogCategories?: SitemapCategoryRow[];
};

const LANDING_CHANGE_FREQUENCY = "weekly" as const;
const CONTENT_CHANGE_FREQUENCY = "weekly" as const;

function safeDate(...candidates: (Date | null | undefined)[]): Date | undefined {
  for (const candidate of candidates) {
    if (candidate && candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }
  return undefined;
}

/** Build the complete sitemap from public content rows. Deterministic order. */
export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  const products = input.products ?? [];
  const categories = input.categories ?? [];
  const posts = input.posts ?? [];
  const blogCategories = input.blogCategories ?? [];

  const landing: MetadataRoute.Sitemap = [
    {
      url: canonicalUrl("/"),
      changeFrequency: LANDING_CHANGE_FREQUENCY,
      priority: 1,
      lastModified: safeDate(
        ...products.map((p) => p.updatedAt),
        ...posts.map((p) => p.updatedAt ?? p.publishedAt),
      ),
    },
    {
      url: canonicalUrl("/products"),
      changeFrequency: LANDING_CHANGE_FREQUENCY,
      priority: 0.9,
      lastModified: safeDate(...products.map((p) => p.updatedAt)),
    },
    {
      url: canonicalUrl("/categories"),
      changeFrequency: LANDING_CHANGE_FREQUENCY,
      priority: 0.8,
      lastModified: safeDate(...categories.map((c) => c.updatedAt)),
    },
    {
      url: canonicalUrl("/blog"),
      changeFrequency: LANDING_CHANGE_FREQUENCY,
      priority: 0.8,
      lastModified: safeDate(...posts.map((p) => p.updatedAt ?? p.publishedAt)),
    },
    { url: canonicalUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
    { url: canonicalUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: canonicalUrl("/faq"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: canonicalUrl(categoryPath(category.slug)),
    lastModified: safeDate(category.updatedAt),
    changeFrequency: CONTENT_CHANGE_FREQUENCY,
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: canonicalUrl(productPath(product.slug)),
    lastModified: safeDate(product.updatedAt),
    changeFrequency: CONTENT_CHANGE_FREQUENCY,
    priority: 0.8,
  }));

  const blogCategoryEntries: MetadataRoute.Sitemap = blogCategories.map((category) => ({
    url: canonicalUrl(blogCategoryPath(category.slug)),
    lastModified: safeDate(category.updatedAt),
    changeFrequency: CONTENT_CHANGE_FREQUENCY,
    priority: 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: canonicalUrl(blogPostPath(post.slug)),
    lastModified: safeDate(post.updatedAt, post.publishedAt),
    changeFrequency: CONTENT_CHANGE_FREQUENCY,
    priority: 0.7,
  }));

  return [...landing, ...productEntries, ...categoryEntries, ...blogCategoryEntries, ...postEntries];
}
