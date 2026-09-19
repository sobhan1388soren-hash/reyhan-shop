import Link from "next/link";

// ArticleBreadcrumb — compact editorial breadcrumb. Paths are the blog's
// own URLs; the leaf category of the current page is linked so deep trees
// stay navigable.

export function BlogBreadcrumb({
  category,
  postTitle,
}: {
  /** Leaf category of the current page (only name/slug are displayed). */
  category?: { name: string; slug: string } | null;
  postTitle?: string;
}) {
  return (
    <nav aria-label="مسیر سایت" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link href="/" className="transition-colors hover:text-[var(--reyhan-blue-700)]">
            خانه
          </Link>
        </li>
        <li aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-3 rtl:rotate-180" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </li>
        <li>
          <Link href="/blog" className="transition-colors hover:text-[var(--reyhan-blue-700)]">
            وبلاگ
          </Link>
        </li>
        {category && (
          <>
            <li aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-3 rtl:rotate-180" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </li>
            <li>
              <Link
                href={`/blog/category/${category.slug}`}
                className="transition-colors hover:text-[var(--reyhan-blue-700)]"
              >
                {category.name}
              </Link>
            </li>
          </>
        )}
        {postTitle && (
          <>
            <li aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-3 rtl:rotate-180" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </li>
            <li className="min-w-0">
              <span className="block max-w-[12rem] truncate font-medium text-foreground sm:max-w-xs">
                {postTitle}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
