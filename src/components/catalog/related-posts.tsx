import Link from "next/link";
import { formatFaDate } from "@/lib/catalog/format";
import type { RelatedPostView } from "@/lib/catalog/product-detail";

// Related educational content — blog posts linked to the product by keywords

export function RelatedPostsSection({ posts }: { posts: RelatedPostView[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-posts-heading" className="space-y-4">
      <h2 id="related-posts-heading" className="text-lg font-semibold text-foreground">
        مطالب آموزشی مرتبط
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-semibold leading-6 text-foreground group-hover:text-[var(--reyhan-blue-700)]">
              {post.title}
            </p>
            {post.excerpt && (
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">
                {post.excerpt}
              </p>
            )}
            <p className="mt-auto pt-4 text-xs text-muted-foreground">
              {post.publishedAt ? formatFaDate(post.publishedAt) : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
