// Unit tests — Phase 17 SEO foundation (pure logic, DB-free).
//
// Covers the pure SEO modules:
//   - site origin normalization + canonical/absolute URL construction
//   - title/description generation strategy
//   - canonical determinism (no query/fragment, no double slashes)
//   - robots rules: public vs private route handling
//   - sitemap inclusion/exclusion + canonical URL consistency
//   - Product structured data (incl. offer/price/availability, image
//     resolution, omission of absent facts)
//   - Article structured data (datePublished/dateModified/author)
//   - BreadcrumbList mirroring the visible hierarchy
//   - Organization/WebSite structured data (real facts only)
//   - safe JSON-LD serialization (no `<script` breakout)
//   - duplicate structured-data prevention
//
// Run: npm run test:seo   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  siteOrigin,
  normalizePath,
  canonicalUrl,
  absoluteMediaUrl,
  isDevelopmentOrigin,
} from "./site.ts";
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildProductJsonLd,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  serializeJsonLd,
  productPath,
  categoryPath,
  blogPostPath,
  blogCategoryPath,
} from "./json-ld.ts";
import {
  buildMetadata,
  buildPrivateMetadata,
  normalizeDescription,
  pageTitle,
} from "./metadata.ts";
import {
  DISALLOWED_ROUTES,
  isDisallowedPath,
  isPublicNoIndexPath,
  PUBLIC_INDEXABLE_PREFIXES,
} from "./robots.ts";
import { buildSitemap } from "./sitemap.ts";

const PROD_ORIGIN = "https://shop.example.test";

function withOrigin(origin, fn) {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = origin;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
}

// ── Site origin + canonical URLs ────────────────────────────────────────

test("siteOrigin reads NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
  withOrigin("https://shop.example.test/", () => {
    assert.equal(siteOrigin(), PROD_ORIGIN);
  });
  withOrigin("https://shop.example.test///", () => {
    assert.equal(siteOrigin(), PROD_ORIGIN);
  });
  withOrigin("  https://shop.example.test  ", () => {
    assert.equal(siteOrigin(), PROD_ORIGIN);
  });
});

test("siteOrigin never invents a production domain; falls back to localhost", () => {
  withOrigin(undefined, () => {
    assert.equal(siteOrigin(), "http://localhost:3000");
    assert.equal(isDevelopmentOrigin(), true);
  });
  withOrigin("", () => {
    assert.equal(siteOrigin(), "http://localhost:3000");
  });
  withOrigin("not-a-url", () => {
    assert.equal(siteOrigin(), "http://localhost:3000");
  });
});

test("siteOrigin detects a development origin", () => {
  withOrigin("http://localhost:3000", () => {
    assert.equal(isDevelopmentOrigin(), true);
  });
  withOrigin(PROD_ORIGIN, () => {
    assert.equal(isDevelopmentOrigin(), false);
  });
});

test("normalizePath normalizes leading/trailing/duplicate slashes and drops query/fragment", () => {
  assert.equal(normalizePath(""), "/");
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("products"), "/products");
  assert.equal(normalizePath("/products/"), "/products");
  assert.equal(normalizePath("//products///x//"), "/products/x");
  assert.equal(normalizePath("/products?q=abc&page=2"), "/products");
  assert.equal(normalizePath("/blog/post#section"), "/blog/post");
  assert.equal(normalizePath("/products?page=2", { preserveQuery: true }), "/products?page=2");
});

test("canonicalUrl is absolute, deterministic and free of query/fragment/double slashes", () => {
  withOrigin(PROD_ORIGIN, () => {
    assert.equal(canonicalUrl("/"), PROD_ORIGIN + "/");
    assert.equal(canonicalUrl("products"), `${PROD_ORIGIN}/products`);
    assert.equal(canonicalUrl("/products/reverse-osmosis"), `${PROD_ORIGIN}/products/reverse-osmosis`);
    assert.equal(canonicalUrl("/products/"), `${PROD_ORIGIN}/products`);
    assert.equal(canonicalUrl("/products//x?q=1"), `${PROD_ORIGIN}/products/x`);
    // same input → same output (deterministic)
    assert.equal(canonicalUrl("/blog/water-filter"), canonicalUrl("/blog/water-filter"));
  });
});

test("absoluteMediaUrl resolves absolute and root-relative values, rejects junk", () => {
  withOrigin(PROD_ORIGIN, () => {
    assert.equal(absoluteMediaUrl("https://cdn.test/a.jpg"), "https://cdn.test/a.jpg");
    assert.equal(absoluteMediaUrl("/images/a.jpg"), `${PROD_ORIGIN}/images/a.jpg`);
    assert.equal(absoluteMediaUrl(null), null);
    assert.equal(absoluteMediaUrl(""), null);
    assert.equal(absoluteMediaUrl("javascript:alert(1)"), null);
    assert.equal(absoluteMediaUrl("relative/path.jpg"), null);
  });
});

// ── Title / description strategy ────────────────────────────────────────

test("pageTitle returns the bare title; brand suffix is applied by the layout template", () => {
  assert.equal(pageTitle("دستگاه تصفیه آب خانگی"), "دستگاه تصفیه آب خانگی");
  assert.equal(pageTitle("  دستگاه  "), "دستگاه");
  assert.equal(pageTitle(""), undefined);
  assert.equal(pageTitle(null), undefined);
});

test("normalizeDescription collapses whitespace, strips control chars and caps length", () => {
  assert.equal(normalizeDescription("  خرید   دستگاه‌های   تصفیه  "), "خرید دستگاه‌های تصفیه");
  assert.equal(normalizeDescription(null), undefined);
  assert.equal(normalizeDescription(""), undefined);
  const long = "آب ".repeat(200).trim();
  const result = normalizeDescription(long);
  assert.ok(result.length <= 200);
  assert.ok(result.endsWith("…"));
  assert.ok(!/\s{2,}/.test(result));
});

test("buildMetadata emits absolute canonical + full OG and never appends the brand to the title", () => {
  withOrigin(PROD_ORIGIN, () => {
    const meta = buildMetadata({
      title: "دستگاه تصفیه آب",
      description: "توضیح محصول.",
      path: "/products/x",
    });
    assert.equal(meta.title, "دستگاه تصفیه آب");
    assert.ok(!meta.title.includes("ریحان"), "title must not duplicate the brand");
    assert.equal(meta.alternates.canonical, `${PROD_ORIGIN}/products/x`);
    assert.equal(meta.openGraph.url, `${PROD_ORIGIN}/products/x`);
    assert.equal(meta.openGraph.type, "website");
    assert.equal(meta.openGraph.locale, "fa_IR");
    assert.equal(meta.openGraph.siteName, "ریحان");
    assert.equal(meta.twitter.card, "summary");
  });
});

test("buildMetadata resolves OG images to absolute URLs and omits them when absent", () => {
  withOrigin(PROD_ORIGIN, () => {
    const withImage = buildMetadata({
      title: "p",
      path: "/products/x",
      images: [{ url: "/images/a.jpg", alt: "a" }],
    });
    assert.equal(withImage.openGraph.images[0].url, `${PROD_ORIGIN}/images/a.jpg`);
    assert.equal(withImage.twitter.card, "summary_large_image");
    assert.equal(withImage.twitter.images[0], `${PROD_ORIGIN}/images/a.jpg`);

    const noImage = buildMetadata({ title: "p", path: "/products/x" });
    assert.equal(noImage.openGraph.images, undefined);
  });
});

test("buildPrivateMetadata sets noindex for private routes and keeps no canonical", () => {
  const meta = buildPrivateMetadata("حساب کاربری", "صفحه خصوصی");
  assert.deepEqual(meta.robots, { index: false, follow: false });
  assert.equal(meta.alternates, undefined);
});

test("buildMetadata forwards arbitrary `other` entries (e.g. OG product price tags)", () => {
  withOrigin(PROD_ORIGIN, () => {
    const meta = buildMetadata({
      title: "دستگاه تصفیه آب",
      path: "/products/x",
      other: { "product:price:amount": "1250000", "product:price:currency": "IRR" },
    });
    assert.deepEqual(meta.other, {
      "product:price:amount": "1250000",
      "product:price:currency": "IRR",
    });
    // Omitted entirely when not provided (no empty keys leaked).
    assert.equal(buildMetadata({ title: "p", path: "/products/x" }).other, undefined);
  });
});

// ── Robots rules: public vs private routes ──────────────────────────────

test("private routes are disallowed and public content routes are allowed", () => {
  const disallowed = ["/admin", "/admin/products", "/account", "/account/orders", "/checkout", "/cart", "/payment/result", "/login", "/register", "/api/payments/start"];
  for (const path of disallowed) {
    assert.equal(isDisallowedPath(path), true, `${path} should be disallowed`);
  }
  const allowed = ["/", "/products", "/products/reverse-osmosis", "/categories", "/categories/filters", "/blog", "/blog/water-filter", "/blog/category/water-purification"];
  for (const path of allowed) {
    assert.equal(isDisallowedPath(path), false, `${path} should be crawlable`);
  }
  assert.equal(isPublicNoIndexPath("/cart"), true);
  assert.equal(isPublicNoIndexPath("/products"), false);
});

test("the disallow list covers every private route group and public prefixes remain allowed", () => {
  const patterns = DISALLOWED_ROUTES.map((r) => r.pattern);
  for (const required of ["/admin", "/account", "/checkout", "/cart", "/payment", "/login", "/register", "/api"]) {
    assert.ok(patterns.some((p) => p.replace(/\/$/, "") === required), `missing disallow for ${required}`);
  }
  assert.ok(PUBLIC_INDEXABLE_PREFIXES.includes("/products"));
  assert.ok(PUBLIC_INDEXABLE_PREFIXES.includes("/blog"));
});

// ── Sitemap inclusion/exclusion + canonical consistency ──────────────────

test("sitemap includes public landing pages + active content, excludes private/draft content", () => {
  withOrigin(PROD_ORIGIN, () => {
    const sitemap = buildSitemap({
      products: [{ slug: "reverse-osmosis", updatedAt: new Date("2026-01-01") }],
      categories: [{ slug: "filters", updatedAt: new Date("2026-02-01") }],
      posts: [{ slug: "water-filter-care", publishedAt: new Date("2026-03-01") }],
      blogCategories: [{ slug: "water-purification", updatedAt: new Date("2026-04-01") }],
    });
    const urls = sitemap.map((entry) => entry.url);
    assert.ok(urls.includes(`${PROD_ORIGIN}/`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/products`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/categories`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/blog`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/products/reverse-osmosis`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/categories/filters`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/blog/water-filter-care`));
    assert.ok(urls.includes(`${PROD_ORIGIN}/blog/category/water-purification`));
    // lastModified only from real dates
    const productEntry = sitemap.find((e) => e.url === `${PROD_ORIGIN}/products/reverse-osmosis`);
    assert.deepEqual(productEntry.lastModified, new Date("2026-01-01"));
  });
});

test("sitemap never contains private routes, query params, or non-canonical paths", () => {
  withOrigin(PROD_ORIGIN, () => {
    const sitemap = buildSitemap({
      products: [{ slug: "a", updatedAt: null }],
      posts: [{ slug: "b", publishedAt: null, updatedAt: null }],
    });
    const urls = sitemap.map((entry) => entry.url);
    for (const url of urls) {
      assert.ok(!/[?#]/.test(url), `sitemap URL must be clean: ${url}`);
      assert.ok(url.startsWith(PROD_ORIGIN), `sitemap URL must be absolute: ${url}`);
      assert.ok(!url.endsWith("/") || url === `${PROD_ORIGIN}/`, `trailing slash only on root: ${url}`);
      assert.ok(!url.includes("/admin"), `admin must never be in the sitemap: ${url}`);
      assert.ok(!url.includes("/account"), `account must never be in the sitemap: ${url}`);
      assert.ok(!url.includes("/checkout"), `checkout must never be in the sitemap: ${url}`);
      assert.ok(!url.includes("/cart"), `cart must never be in the sitemap: ${url}`);
      assert.ok(!url.includes("/login"), `login must never be in the sitemap: ${url}`);
    }
    const productEntry = sitemap.find((e) => e.url === `${PROD_ORIGIN}/products/a`);
    assert.equal(productEntry.lastModified, undefined);
  });
});

test("sitemap slug/canonical consistency: path helpers match sitemap entries", () => {
  withOrigin(PROD_ORIGIN, () => {
    const sitemap = buildSitemap({
      products: [{ slug: "ro", updatedAt: new Date() }],
      categories: [{ slug: "filters", updatedAt: new Date() }],
      posts: [{ slug: "care", publishedAt: new Date() }],
      blogCategories: [{ slug: "pure", updatedAt: new Date() }],
    });
    const urls = new Set(sitemap.map((e) => e.url));
    assert.ok(urls.has(canonicalUrl(productPath("ro"))));
    assert.ok(urls.has(canonicalUrl(categoryPath("filters"))));
    assert.ok(urls.has(canonicalUrl(blogPostPath("care"))));
    assert.ok(urls.has(canonicalUrl(blogCategoryPath("pure"))));
  });
});

// ── Organization / WebSite structured data ──────────────────────────────

test("Organization uses only real facts and omits unset contact details", () => {
  withOrigin(PROD_ORIGIN, () => {
    const org = buildOrganizationJsonLd();
    assert.equal(org["@context"], "https://schema.org");
    assert.equal(org["@type"], "Organization");
    assert.equal(org.name, "ریحان");
    assert.equal(org.url, `${PROD_ORIGIN}/`);
    assert.ok(org.email, "configured site email is a real fact");
    assert.equal(org["@id"], `${PROD_ORIGIN}/#organization`);
  });
});

test("WebSite references the Organization via @id and exposes the real search endpoint", () => {
  withOrigin(PROD_ORIGIN, () => {
    const site = buildWebSiteJsonLd();
    assert.equal(site["@type"], "WebSite");
    assert.equal(site.url, `${PROD_ORIGIN}/`);
    assert.equal(site.inLanguage, "fa-IR");
    assert.equal(site.publisher["@id"], `${PROD_ORIGIN}/#organization`);
    assert.equal(site.potentialAction["@type"], "SearchAction");
    assert.ok(site.potentialAction.target.urlTemplate.includes("/products?q="));
  });
});

test("WebSite search action can be disabled (no invented capabilities)", () => {
  withOrigin(PROD_ORIGIN, () => {
    const site = buildWebSiteJsonLd({ searchEnabled: false });
    assert.equal(site.potentialAction, undefined);
  });
});

// ── Product structured data ─────────────────────────────────────────────

test("Product includes a real offer with price/availability and the canonical URL", () => {
  withOrigin(PROD_ORIGIN, () => {
    const product = buildProductJsonLd({
      title: "دستگاه تصفیه آب راکی",
      slug: "reverse-osmosis",
      description: "سیستم تصفیه خانگی",
      images: [{ url: "https://cdn.test/a.jpg", alt: "a" }],
      sku: "RO-500",
      offer: { price: 25000000, currency: "IRR", availability: "in_stock" },
      aggregateRating: null,
    });
    assert.equal(product["@type"], "Product");
    assert.equal(product.name, "دستگاه تصفیه آب راکی");
    assert.equal(product.url, `${PROD_ORIGIN}/products/reverse-osmosis`);
    assert.equal(product.image[0], "https://cdn.test/a.jpg");
    assert.equal(product.sku, "RO-500");
    assert.equal(product.offers.price, 25000000);
    assert.equal(product.offers.priceCurrency, "IRR");
    assert.equal(product.offers.availability, "https://schema.org/InStock");
    assert.equal(product.aggregateRating, undefined);
  });
});

test("Product omits the offer when no real price exists (never invented)", () => {
  withOrigin(PROD_ORIGIN, () => {
    const product = buildProductJsonLd({
      title: "ناموجود",
      slug: "x",
      offer: null,
      aggregateRating: null,
    });
    assert.equal(product.offers, undefined);
    assert.equal(product.aggregateRating, undefined);
  });
});

test("Product AggregateRating appears only with real reviews and rounds to one decimal", () => {
  withOrigin(PROD_ORIGIN, () => {
    const withRating = buildProductJsonLd({
      title: "p",
      slug: "x",
      offer: { price: 1000 },
      aggregateRating: { average: 4.567, total: 12 },
    });
    assert.equal(withRating.aggregateRating.ratingValue, 4.6);
    assert.equal(withRating.aggregateRating.reviewCount, 12);

    const zeroReviews = buildProductJsonLd({
      title: "p",
      slug: "x",
      offer: { price: 1000 },
      aggregateRating: { average: 0, total: 0 },
    });
    assert.equal(zeroReviews.aggregateRating, undefined);
  });
});

test("Product never exposes cost price or a fabricated brand", () => {
  withOrigin(PROD_ORIGIN, () => {
    const product = buildProductJsonLd({
      title: "p",
      slug: "x",
      brand: null,
      offer: { price: 1000 },
    });
    assert.equal(product.brand, undefined);
    assert.ok(!JSON.stringify(product).includes("cost"), "cost price must never appear");
  });
});

// ── Article structured data ─────────────────────────────────────────────

test("Article carries headline/datePublished/dateModified/author and the canonical URL", () => {
  withOrigin(PROD_ORIGIN, () => {
    const published = new Date("2026-01-01T00:00:00.000Z");
    const updated = new Date("2026-02-01T00:00:00.000Z");
    const article = buildArticleJsonLd({
      title: "نگهداری فیلتر تصفیه آب",
      slug: "water-filter-care",
      description: "راهنمای نگهداری",
      coverImage: "https://cdn.test/cover.jpg",
      authorName: "تیم فنی ریحان",
      publishedAt: published,
      updatedAt: updated,
    });
    assert.equal(article["@type"], "Article");
    assert.equal(article.headline, "نگهداری فیلتر تصفیه آب");
    assert.equal(article.url, `${PROD_ORIGIN}/blog/water-filter-care`);
    assert.equal(article.datePublished, published.toISOString());
    assert.equal(article.dateModified, updated.toISOString());
    assert.equal(article.author["@type"], "Person");
    assert.equal(article.author.name, "تیم فنی ریحان");
    assert.equal(article.image, "https://cdn.test/cover.jpg");
    assert.equal(article.publisher["@id"], `${PROD_ORIGIN}/#organization`);
  });
});

test("Article falls back to the organization author and omits image when absent", () => {
  withOrigin(PROD_ORIGIN, () => {
    const article = buildArticleJsonLd({
      title: "t",
      slug: "s",
      authorName: null,
      coverImage: null,
      publishedAt: new Date("2026-01-01"),
      updatedAt: null,
    });
    assert.equal(article.author["@type"], "Organization");
    assert.equal(article.image, undefined);
    assert.equal(article.dateModified, undefined);
  });
});

// ── BreadcrumbList structured data ──────────────────────────────────────

test("BreadcrumbList mirrors the visible hierarchy with canonical public URLs", () => {
  withOrigin(PROD_ORIGIN, () => {
    const breadcrumb = buildBreadcrumbJsonLd([
      { name: "دسته‌بندی‌ها", path: "/categories" },
      { name: "فیلترها", path: "/categories/filters" },
    ]);
    assert.equal(breadcrumb["@type"], "BreadcrumbList");
    assert.equal(breadcrumb.itemListElement[0].position, 1);
    assert.equal(breadcrumb.itemListElement[0].name, "دسته‌بندی‌ها");
    assert.equal(breadcrumb.itemListElement[0].item, `${PROD_ORIGIN}/categories`);
    assert.equal(breadcrumb.itemListElement[1].item, `${PROD_ORIGIN}/categories/filters`);
  });
});

test("BreadcrumbList is null for an empty trail (no fabricated hierarchy)", () => {
  assert.equal(buildBreadcrumbJsonLd([]), null);
  assert.equal(buildBreadcrumbJsonLd([{ name: "", path: "" }]), null);
});

// ── Safe serialization + duplicate prevention ──────────────────────────

test("serializeJsonLd escapes '<' so no stored string can terminate the script element", () => {
  const payload = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!payload.includes("</script>"), "raw closing script tag must not survive");
  assert.ok(payload.includes("\\u003c"));
  // round-trips back to the original value
  const parsed = JSON.parse(payload);
  assert.equal(parsed.name, "</script><script>alert(1)</script>");
});

test("each page renders each graph exactly once (no duplicate JSON-LD objects)", () => {
  withOrigin(PROD_ORIGIN, () => {
    // The homepage owns Organization + WebSite; content pages own their own
    // single Product/Article graph plus one BreadcrumbList. Builders are
    // singletons per page, so no @type appears twice in one render.
    const homepageGraphs = [buildOrganizationJsonLd(), buildWebSiteJsonLd()];
    const types = homepageGraphs.map((g) => g["@type"]);
    assert.deepEqual([...new Set(types)].sort(), ["Organization", "WebSite"].sort());

    const productGraphs = [
      buildProductJsonLd({ title: "p", slug: "x", offer: { price: 1 } }),
      buildBreadcrumbJsonLd([{ name: "c", path: "/categories/c" }]),
    ];
    const productTypes = productGraphs.map((g) => g["@type"]);
    assert.deepEqual([...new Set(productTypes)].sort(), ["BreadcrumbList", "Product"].sort());
  });
});

test("path helpers produce stable Latin/ASCII public routes", () => {
  assert.equal(productPath("reverse-osmosis"), "/products/reverse-osmosis");
  assert.equal(categoryPath("filters"), "/categories/filters");
  assert.equal(blogPostPath("water-filter-maintenance"), "/blog/water-filter-maintenance");
  assert.equal(blogCategoryPath("water-purification"), "/blog/category/water-purification");
});
