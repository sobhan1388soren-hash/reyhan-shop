import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PurchasePanel } from "@/components/catalog/purchase-panel";
import { MobilePurchaseBar } from "@/components/catalog/mobile-purchase-bar";
import { ProductInfoTabs } from "@/components/catalog/product-info-tabs";
import { TrustBar } from "@/components/catalog/trust-bar";
import { RelatedProducts } from "@/components/catalog/related-products";
import { ProductReviewsSection, ProductQnaSection } from "@/components/catalog/reviews";
import { ReviewForm } from "@/components/catalog/review-form";
import { QuestionForm } from "@/components/catalog/question-form";
import { ProductFaqSection } from "@/components/catalog/faq-section";
import { RelatedPostsSection } from "@/components/catalog/related-posts";
import { EmptyState } from "@/components/catalog/empty-state";
import { CategoryBreadcrumb } from "@/components/catalog/category-breadcrumb";
import { getCurrentUser } from "@/lib/auth/dal";
import { getReviewFormContext } from "@/lib/reviews/service";
import {
  getProductBySlug,
  getRelatedProducts,
  getCategoryAncestors,
} from "@/lib/catalog/queries";
import {
  getProductReviews,
  getProductQuestions,
  getRelatedPostsForProduct,
} from "@/lib/catalog/product-detail";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

type PageProps = {
  params: Promise<{ productSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);
  if (!product) {
    return { title: "محصول یافت نشد" };
  }
  const description =
    product.shortDescription ?? product.description?.slice(0, 160) ?? undefined;
  const minPrice = product.priceRange.min;
  return {
    title: product.title,
    description,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: product.title,
      description,
      url: `${SITE_URL}/products/${product.slug}`,
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
    ...(minPrice != null
      ? { other: { "product:price:amount": String(Math.round(minPrice / 10)), "product:price:currency": "IRR" } }
      : {}),
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);

  if (!product) {
    return (
      <Container className="flex items-center justify-center py-20">
        <EmptyState
          title="محصول یافت نشد"
          description="محصول مورد نظر شما یافت نشد یا از فروشگاه حذف شده است."
          actionHref="/products"
          actionLabel="مشاهده محصولات موجود"
        />
      </Container>
    );
  }

  if (product.status !== "ACTIVE") {
    notFound();
  }

  const categoryIds = product.categories.map((c) => c.id);
  const categoryNames = product.categories.map((c) => c.name);

  // Session context for the review/question forms. canReview is derived
  // server-side (purchased + no existing review row).
  const [user, related, ancestors, reviewsSummary, questions, relatedPosts] =
    await Promise.all([
      getCurrentUser(),
      getRelatedProducts(product.id, categoryIds, 4),
      product.categories[0]
        ? getCategoryAncestors(product.categories[0].id)
        : Promise.resolve([]),
      getProductReviews(product.id),
      getProductQuestions(product.id),
      getRelatedPostsForProduct(product.title, categoryNames, 3),
    ]);
  const { canReview } = await getReviewFormContext(user?.id ?? null, product.id);

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];

  return (
    <Container className="py-6 pb-24 lg:pb-10">
      <CategoryBreadcrumb ancestors={ancestors} />

      {/* ── Purchase area ── */}
      <main className="pt-4">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Right side in RTL = gallery */}
          <div className="lg:col-span-7">
            <ProductGallery images={product.images} productTitle={product.title} />

            {/* Short description under gallery */}
            {product.shortDescription && (
              <p className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
                {product.shortDescription}
              </p>
            )}
          </div>

          {/* Left side in RTL = purchase info */}
          <div className="lg:col-span-5">
            <div id="purchase-panel" className="scroll-mt-24 space-y-4">
              <div>
                <h1 className="text-2xl font-bold leading-9 text-foreground sm:text-3xl">
                  {product.title}
                </h1>
                {product.categories.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {product.categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/categories/${cat.slug}`}
                        className="rounded-full bg-muted px-2.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </p>
                )}
              </div>

              <PurchasePanel
                productTitle={product.title}
                variants={product.variants}
                defaultVariantId={defaultVariant?.id}
              />
            </div>
          </div>
        </div>

        {/* ── Trust & support ── */}
        <div className="mt-8">
          <TrustBar />
        </div>

        {/* ── Product information tabs ── */}
        <div className="mt-8 rounded-xl border bg-card p-5 sm:p-6">
          <ProductInfoTabs
            description={product.description}
            specifications={product.specifications}
          />
        </div>

        {/* ── Related products ── */}
        <div className="mt-10">
          <RelatedProducts products={related} />
        </div>

        {/* ── FAQ ── */}
        <div className="mt-10">
          <ProductFaqSection specifications={product.specifications} />
        </div>

        {/* ── Reviews ── */}
        <div className="mt-10 space-y-5">
          <ProductReviewsSection summary={reviewsSummary} />
          <ReviewForm
            productId={product.id}
            productSlug={product.slug}
            canReview={canReview}
            isAuthenticated={!!user}
          />
        </div>

        {/* ── Q&A ── */}
        <div className="mt-10 space-y-5">
          <ProductQnaSection questions={questions} />
          <QuestionForm
            productId={product.id}
            productSlug={product.slug}
            isAuthenticated={!!user}
          />
        </div>

        {/* ── Related educational content ── */}
        <div className="mt-10">
          <RelatedPostsSection posts={relatedPosts} />
        </div>
      </main>

      {/* Mobile sticky purchase bar */}
      <MobilePurchaseBar
        productTitle={product.title}
        variants={product.variants}
        defaultVariantId={defaultVariant?.id}
      />
    </Container>
  );
}
