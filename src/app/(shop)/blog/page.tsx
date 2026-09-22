import { Container, Section } from "@/components/layout/container";
import { PostCard } from "@/components/blog/post-card";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { PaginationBar } from "@/components/catalog/pagination-bar";
import { EmptyState } from "@/components/catalog/empty-state";
import {
  getPublishedPosts,
  getFeaturedPosts,
  getBlogCategoryTree,
} from "@/lib/blog/queries";
import { toFaDigits } from "@/lib/catalog/format";
import { SITE_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "وبلاگ ریحان",
  description:
    "مقالات تخصصی تصفیه آب خانگی، راهنمای خرید و نگهداری دستگاه‌های تصفیه آب.",
  path: "/blog",
  type: "website",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const page = typeof resolved.page === "string" ? resolved.page : undefined;

  const [result, featured, categories] = await Promise.all([
    getPublishedPosts({ page }),
    getFeaturedPosts(3),
    getBlogCategoryTree(),
  ]);

  const isFirstPage = result.meta.page === 1;

  return (
    <>
      {/* Hero */}
      <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/70 via-white to-white pb-10 pt-12 sm:pb-14 sm:pt-16 lg:pb-20 lg:pt-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--reyhan-blue-50)] px-3 py-1 text-xs font-medium text-[var(--reyhan-blue-700)]">
              <span className="size-1.5 rounded-full bg-[var(--reyhan-green-500)]" aria-hidden="true" />
              مرکز دانش ریحان
            </span>
            <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              وبلاگ تخصصی تصفیه آب
            </h1>
            <p className="mt-4 text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
              مقالات تخصصی درباره انتخاب، نصب و نگهداری دستگاه‌های تصفیه آب خانگی —
              نوشته تیم فنی {SITE_NAME}.
            </p>
          </div>
        </Container>
      </Section>

      <Section className="bg-background">
        <Container>
          {/* Featured strip — first page only */}
          {isFirstPage && featured.length > 0 && (
            <div className="mb-10">
              <h2 className="mb-4 text-sm font-bold text-foreground">مقالات منتخب</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <BlogSidebar categories={categories} />
            </aside>

            <div className="min-w-0 space-y-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-bold text-foreground">آخرین مقالات</h2>
                <span className="text-xs text-muted-foreground" role="status">
                  {toFaDigits(result.meta.total)} مقاله
                </span>
              </div>

              {result.data.length > 0 ? (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {result.data.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                  <PaginationBar
                    meta={result.meta}
                    basePath="/blog"
                    searchParams={resolved}
                  />
                </>
              ) : (
                <EmptyState
                  title="هنوز مقاله‌ای منتشر نشده است"
                  description="به‌زودی مقالات تخصصی تصفیه آب در این صفحه منتشر می‌شوند."
                  actionHref="/products"
                  actionLabel="مشاهده محصولات"
                />
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
