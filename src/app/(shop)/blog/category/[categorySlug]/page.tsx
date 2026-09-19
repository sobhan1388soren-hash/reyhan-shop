import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Section } from "@/components/layout/container";
import { PostCard } from "@/components/blog/post-card";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { BlogBreadcrumb } from "@/components/blog/article-breadcrumb";
import { PaginationBar } from "@/components/catalog/pagination-bar";
import { EmptyState } from "@/components/catalog/empty-state";
import {
  getBlogCategoryBySlug,
  getBlogCategoryTree,
  getPublishedPosts,
} from "@/lib/blog/queries";
import { toFaDigits } from "@/lib/catalog/format";

type PageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await getBlogCategoryBySlug(categorySlug);
  if (!category) return { title: "دسته‌بندی یافت نشد" };
  return {
    title: category.name,
    description: category.description ?? `مقالات دسته «${category.name}».`,
    alternates: {
      canonical: `/blog/category/${category.slug}`,
    },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: PageProps) {
  const [{ categorySlug }, resolved] = await Promise.all([params, searchParams]);
  const category = await getBlogCategoryBySlug(categorySlug);

  if (!category) notFound();

  const page = typeof resolved.page === "string" ? resolved.page : undefined;
  const [result, categories] = await Promise.all([
    getPublishedPosts({ page, categoryId: category.id }),
    getBlogCategoryTree(),
  ]);

  return (
    <Section className="bg-background py-10 sm:py-14 lg:py-16">
      <Container>
        <BlogBreadcrumb category={category} />

        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{category.name}</h1>
          {category.description && (
            <p className="mt-3 text-pretty text-base leading-8 text-muted-foreground">
              {category.description}
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BlogSidebar categories={categories} activeSlug={category.slug} />
          </aside>

          <div className="min-w-0 space-y-6">
            <span className="text-xs text-muted-foreground" role="status">
              {toFaDigits(result.meta.total)} مقاله در «{category.name}»
            </span>

            {result.data.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {result.data.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
                <PaginationBar
                  meta={result.meta}
                  basePath={`/blog/category/${category.slug}`}
                  searchParams={resolved}
                />
              </>
            ) : (
              <EmptyState
                title="مقاله‌ای در این دسته یافت نشد"
                description="هنوز مقاله‌ای در این دسته‌بندی منتشر نشده است. دسته‌های دیگر را بررسی کنید."
                actionHref="/blog"
                actionLabel="همه مقالات"
              />
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
