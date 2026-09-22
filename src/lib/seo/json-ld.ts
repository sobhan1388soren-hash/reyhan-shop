// Structured data (JSON-LD) builders — Phase 17 SEO foundation.
//
// One central, server-safe serialization layer. Every builder is pure,
// framework-free and DB-free: they accept already-fetched view objects and
// emit plain JSON. Only properties backed by REAL data are included; absent
// values are omitted rather than nulled or invented.
//
// Conservative policy (mirrors Google guidance):
//   - Organization/WebSite only on the homepage (single connected graph)
//   - Product only on the product page, with an Offer only when a real price
//     exists, and AggregateRating only when real approved reviews exist
//   - Article only on published blog posts
//   - BreadcrumbList mirrors the visible breadcrumb hierarchy exactly
//   - no Review/FAQ markup is emitted unless real, page-visible data exists
//
// Safe serialization: `<` is escaped so a stored string can never terminate
// the `<script>` element (defense-in-depth on top of the write-time
// sanitizers for blog content / admin text).

import { SITE_DESCRIPTION, SITE_EMAIL, SITE_NAME } from "../constants.ts";
import { canonicalUrl, absoluteMediaUrl } from "./site.ts";

// ── Public route vocabulary (single source; mirrors the router) ──────────

export const PUBLIC_ROUTES = {
  home: "/",
  products: "/products",
  categories: "/categories",
  blog: "/blog",
} as const;

export function productPath(slug: string): string {
  return `/products/${slug}`;
}
export function categoryPath(slug: string): string {
  return `/categories/${slug}`;
}
export function blogCategoryPath(slug: string): string {
  return `/blog/category/${slug}`;
}
export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

// ── Serialization ────────────────────────────────────────────────────────

/**
 * Serialize a JSON-LD object for a `<script type="application/ld+json">`
 * element. Escapes `<` (and `<script` sequences in particular) so no stored
 * value can break out of the element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Drop null/undefined values from a record so absent facts are omitted. */
function compact<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

// ── Homepage: Organization + WebSite ─────────────────────────────────────
// Only real organization facts from lib/constants. Phone/address are empty
// placeholders in this project, so contactPoint/address are omitted entirely
// rather than fabricated.

export type OrganizationJsonLdInput = {
  name?: string;
  email?: string;
  description?: string;
  url?: string;
};

export function buildOrganizationJsonLd(input?: OrganizationJsonLdInput): Record<string, unknown> {
  const url = input?.url ?? canonicalUrl(PUBLIC_ROUTES.home);
  const record = compact({
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: input?.name ?? SITE_NAME,
    url,
    description: input?.description ?? SITE_DESCRIPTION,
    email: input?.email ?? SITE_EMAIL,
  });
  return { "@context": "https://schema.org", ...record };
}

export type WebSiteJsonLdInput = {
  name?: string;
  url?: string;
  searchEnabled?: boolean;
};

export function buildWebSiteJsonLd(input?: WebSiteJsonLdInput): Record<string, unknown> {
  const url = input?.url ?? canonicalUrl(PUBLIC_ROUTES.home);
  const searchEnabled = input?.searchEnabled ?? true;
  const potentialAction =
    searchEnabled === false
      ? undefined
      : {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${canonicalUrl(PUBLIC_ROUTES.products)}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        };
  const record = compact({
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: input?.name ?? SITE_NAME,
    url,
    inLanguage: "fa-IR",
    publisher: { "@id": `${url}#organization` },
    potentialAction,
  });
  return { "@context": "https://schema.org", ...record };
}

// ── BreadcrumbList ───────────────────────────────────────────────────────
// `items` is the visible breadcrumb trail (root → … → current page). The
// final item is the current page itself; URLs are the canonical public ones.

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> | null {
  const trail = items.filter((item) => item && item.name && item.path);
  if (trail.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

// ── Product ──────────────────────────────────────────────────────────────
// Offer requires a real price; availability must reflect actual inventory.
// AggregateRating requires real approved reviews (see ProductReviewsSummary).
// costPrice is NEVER emitted. Brand/SKU only when actually present.

export type ProductOfferInput = {
  price: number; // Rial
  currency?: string;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unavailable";
};

export type ProductJsonLdInput = {
  title: string;
  slug: string;
  description?: string | null;
  images?: { url: string; alt?: string | null }[];
  sku?: string | null;
  brand?: string | null;
  offer?: ProductOfferInput | null;
  aggregateRating?: { average: number; total: number } | null;
};

const AVAILABILITY_TO_SCHEMA: Record<NonNullable<ProductOfferInput["availability"]>, string> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
  unavailable: "https://schema.org/PreOrder",
};

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const url = canonicalUrl(productPath(input.slug));
  const imageList = (input.images ?? [])
    .map((image) => absoluteMediaUrl(image.url))
    .filter((value): value is string => value !== null);
  const offer = input.offer && input.offer.price != null
    ? compact({
        "@type": "Offer",
        url,
        price: input.offer.price,
        priceCurrency: input.offer.currency ?? "IRR",
        availability: input.offer.availability
          ? AVAILABILITY_TO_SCHEMA[input.offer.availability]
          : undefined,
      })
    : undefined;
  const aggregateRating =
    input.aggregateRating && input.aggregateRating.total > 0 && input.aggregateRating.average > 0
      ? compact({
          "@type": "AggregateRating",
          ratingValue: Math.round(input.aggregateRating.average * 10) / 10,
          reviewCount: input.aggregateRating.total,
        })
      : undefined;
  const record = compact({
    "@type": "Product",
    "@id": `${url}#product`,
    name: input.title,
    url,
    description: input.description ?? undefined,
    image: imageList.length ? imageList : undefined,
    sku: input.sku ?? undefined,
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    offers: offer ? { ...offer } : undefined,
    aggregateRating,
  });
  return { "@context": "https://schema.org", ...record };
}

// ── Article (blog post) ──────────────────────────────────────────────────
// datePublished only when the post is actually published; dateModified only
// when a reliable updatedAt exists. Author from the real author row.

export type ArticleJsonLdInput = {
  title: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  authorName?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
};

export function buildArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const url = canonicalUrl(blogPostPath(input.slug));
  const image = absoluteMediaUrl(input.coverImage);
  const author = input.authorName
    ? { "@type": "Person", name: input.authorName }
    : { "@type": "Organization", name: SITE_NAME };
  const record = compact({
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description ?? undefined,
    url,
    image: image ?? undefined,
    inLanguage: "fa-IR",
    author,
    publisher: { "@id": `${canonicalUrl(PUBLIC_ROUTES.home)}#organization` },
    datePublished: input.publishedAt ? input.publishedAt.toISOString() : undefined,
    dateModified:
      input.updatedAt && input.updatedAt.getTime() > 0
        ? input.updatedAt.toISOString()
        : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  });
  return { "@context": "https://schema.org", ...record };
}
