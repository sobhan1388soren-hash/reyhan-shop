import Link from "next/link";
import { MediaPlaceholder } from "@/components/common/media-placeholder";
import type { BlogPostCard } from "@/lib/blog/queries";
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";

// PostCard — editorial, medical-clean. Image is URL-only (no upload infra);
// a branded placeholder keeps the grid tidy when no cover is set. Only
// published posts reach this component (the public queries enforce it).

export function PostCard({ post }: { post: BlogPostCard }) {
  const primaryCategory = post.categories[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow duration-200 hover:shadow-md">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImage}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <MediaPlaceholder
              tone="green"
              glyph="image"
              label={primaryCategory?.name ?? "مقاله ریحان"}
            />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {post.categories.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {post.categories.slice(0, 2).map((cat) => (
              <Link
                key={cat.id}
                href={`/blog/category/${cat.slug}`}
                className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--reyhan-blue-50)] hover:text-[var(--reyhan-blue-700)]"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        <Link href={`/blog/${post.slug}`} className="group/title">
          <h3 className="line-clamp-2 text-base font-bold leading-7 text-foreground transition-colors group-hover/title:text-[var(--reyhan-blue-700)]">
            {post.title}
          </h3>
        </Link>

        {post.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            {post.authorName && (
              <span className="truncate font-medium text-foreground/80">{post.authorName}</span>
            )}
            {post.authorName && post.publishedAt && <span aria-hidden="true">·</span>}
            {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatFaDate(post.publishedAt)}</time>}
          </span>
          {post.readingMinutes > 0 && (
            <span className="shrink-0 tabular-nums">{toFaDigits(post.readingMinutes)} دقیقه مطالعه</span>
          )}
        </div>
      </div>
    </article>
  );
}
