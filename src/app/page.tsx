// Reyhan homepage — Phase 16.
//
// Server component; all content is database-backed and loaded server-side in
// a single parallel assembly (src/lib/marketing/homepage.ts). Each section
// self-handles missing data: empty categories/products/posts/promos render
// nothing, and the hero always renders factual structural content. No
// fake/demo data is ever introduced.
//
// Information architecture (fixed order, intentionally not a page builder):
// hero → categories → featured → trust strip → best-selling → promo
// banners → knowledge/blog → consultation CTA.

import { getHomepageData } from "@/lib/marketing/homepage";
import { HomeHero } from "@/components/home/home-hero";
import { HomeCategories } from "@/components/home/home-categories";
import { HomeProductSection } from "@/components/home/home-product-section";
import { HomeTrustStrip } from "@/components/home/home-trust-strip";
import { HomePromoBanners } from "@/components/home/home-promo-banners";
import { HomeBlogSection } from "@/components/home/home-blog-section";
import { HomeConsultationCta } from "@/components/home/home-consultation-cta";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/json-ld";
import { canonicalUrl } from "@/lib/seo/site";
import type { Metadata } from "next";

// The homepage is the canonical root of the site. It is declared HERE (not as
// a root-layout default) so private/noindex routes (cart, account, admin,
// checkout, payment) don't inherit a canonical pointing back to the homepage.
export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

export default async function Home() {
  const { hero, promos, categories, featured, bestSelling, posts } =
    await getHomepageData();

  return (
    <div className="flex flex-1 flex-col">
      {/* Organization + WebSite identity graph — homepage only, real facts */}
      <JsonLd
        id="home-identity"
        data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]}
      />

      {/* Hero — static, single, admin-editable */}
      <HomeHero hero={hero} />

      {/* Categories — top-level active categories only */}
      <HomeCategories categories={categories} />

      {/* Featured — the admin-curated isFeatured selection */}
      <HomeProductSection
        eyebrow="منتخب ریحان"
        id="home-featured-title"
        title="محصولات ویژه"
        description="انتخاب دستیِ محصولات پیشنهادی ریحان از میان کاتالوگ فعال فروشگاه."
        products={featured}
        viewAllHref="/products"
        viewAllLabel="مشاهده همه محصولات"
      />

      {/* Trust / expertise — slim structural band between the two grids */}
      <HomeTrustStrip />

      {/* Best-selling — ranked from real paid-order data only */}
      <HomeProductSection
        eyebrow="پرفروش‌ترین‌ها"
        id="home-bestselling-title"
        title="پرفروش‌ترین محصولات"
        description="بر اساس سفارش‌های پرداخت‌شده و تحویل‌شده واقعی فروشگاه ریحان."
        products={bestSelling}
        viewAllHref="/products"
        viewAllLabel="مشاهده همه محصولات"
      />

      {/* Promotional banners — admin-managed, ordered */}
      <HomePromoBanners banners={promos} />

      {/* Knowledge center — published posts only */}
      <HomeBlogSection posts={posts} />

      {/* Consultation / contact CTA */}
      <HomeConsultationCta />
    </div>
  );
}
