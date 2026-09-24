import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/layout/container";
import { BlogBreadcrumb } from "@/components/blog/article-breadcrumb";
import { PostCard } from "@/components/blog/post-card";
import { ArticleRelatedProducts } from "@/components/blog/related-products";
import {
  getPostBySlug,
  getRelatedPosts,
  getBlogCategoryTree,
} from "@/lib/blog/queries";
import { plainTextFromContent } from "@/lib/blog/content";
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  blogCategoryPath,
} from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/seo/json-ld";

type PageProps = {
  params: Promise<{ postSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postSlug } = await params;
  const post = await getPostBySlug(postSlug);
  if (!post) return { title: "مقاله یافت نشد" };

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || plainTextFromContent(post.content, 160);

  return buildMetadata({
    title,
    description,
    path: `/blog/${post.slug}`,
    type: "article",
    images: post.coverImage ? [{ url: post.coverImage, alt: post.title }] : [],
    publishedTime: post.publishedAt?.toISOString(),
    modifiedTime: post.updatedAt.toISOString(),
    authors: post.authorName ? [post.authorName] : undefined,
  });
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { postSlug } = await params;
  const post = await getPostBySlug(postSlug);

  // Only published posts are reachable here; the query returns null for
  // anything else (drafts stay console-only).
  if (!post) notFound();

  const [related, categories] = await Promise.all([
    getRelatedPosts(post.id, post.categories.map((c) => c.id), 3),
    getBlogCategoryTree(),
  ]);

  const category = post.categories[0] ?? null;

  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    slug: post.slug,
    description: post.seoDescription || post.excerpt || plainTextFromContent(post.content, 160),
    coverImage: post.coverImage,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: "وبلاگ", path: "/blog" },
    ...(category
      ? [{ name: category.name, path: blogCategoryPath(category.slug) }]
      : []),
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <article>
      <JsonLd id="article" data={[articleJsonLd, breadcrumbJsonLd].filter(Boolean)} />

      {/* Header */}
      <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white pb-8 pt-10 sm:pb-12 sm:pt-14">
        <Container size="sm">
          <BlogBreadcrumb category={category} postTitle={post.title} />

          {post.categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/blog/category/${cat.slug}`}
                  className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--reyhan-blue-50)] hover:text-[var(--reyhan-blue-700)]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl lg:text-4xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
              {post.excerpt}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
            {post.authorName && (
              <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <circle cx="8" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3 13c.6-2.2 2.5-3.3 5-3.3s4.4 1.1 5 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {post.authorName}
              </span>
            )}
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()} className="flex items-center gap-1.5">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M2.5 6.5h11M5.5 2v2.4M10.5 2v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {formatFaDate(post.publishedAt)}
              </time>
            )}
            {post.readingMinutes > 0 && (
              <span className="flex items-center gap-1.5 tabular-nums">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 5.2V8l2 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {toFaDigits(post.readingMinutes)} دقیقه مطالعه
              </span>
            )}
          </div>
        </Container>
      </Section>

      {/* Cover image */}
      {post.coverImage && (
        <Section className="pb-0 pt-8 sm:pt-10">
          <Container size="sm">
            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImage}
                alt={post.title}
                className="aspect-[16/8] w-full object-cover"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </Container>
        </Section>
      )}

      {/* Body — content is sanitized on write AND again at read time */}
      <Section className="pt-8 sm:pt-10">
        <Container size="sm">
          <div
            className="prose-rtl"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <ArticleRelatedProducts post={post} />
        </Container>
      </Section>

      {/* More from this category */}
      {related.length > 0 && (
        <Section className="border-t bg-muted/30 pt-10">
          <Container>
            <h2 className="mb-5 text-lg font-bold text-foreground">مقالات مرتبط</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <PostCard key={item.id} post={item} />
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/* Sidebar-free category shortcut on mobile */}
      {categories.length > 0 && (
        <Section className="border-t pt-8 sm:pt-10 lg:hidden">
          <Container size="sm">
            <h2 className="mb-3 text-sm font-bold text-foreground">دسته‌بندی مقالات</h2>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/blog/category/${cat.slug}`}
                  className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--reyhan-blue-50)] hover:text-[var(--reyhan-blue-700)]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </article>
  );
}
