// robots.txt — Phase 17 SEO foundation.
//
// Crawl guidance via the Next.js file convention. This is guidance for
// crawlers, NOT an indexing directive: authoritative per-page index control
// is the `noindex` metadata on private routes (account/auth/admin/cart/
// checkout/payment). Both layers share the same route vocabulary from
// lib/seo/robots so they can never drift apart.
//
// Public storefront content (homepage, products, categories, blog, blog
// categories, blog posts) is intentionally allowed.

import type { MetadataRoute } from "next";
import { siteOrigin, sitemapUrl } from "@/lib/seo/site";
import { DISALLOWED_ROUTES } from "@/lib/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_ROUTES.map((rule) => rule.pattern),
      },
    ],
    sitemap: sitemapUrl(),
    host: siteOrigin(),
  };
}
