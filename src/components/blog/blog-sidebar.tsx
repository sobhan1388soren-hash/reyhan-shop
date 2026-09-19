import Link from "next/link";
import type { BlogCategoryView } from "@/lib/blog/queries";
import { toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

// BlogSidebar — category tree for the blog landing and category pages.
// The tree is server-built (active categories only, published post counts);
// an empty tree renders nothing rather than a fake outline.

function CategoryListNode({
  nodes,
  depth,
  activeSlug,
}: {
  nodes: BlogCategoryView[];
  depth: number;
  activeSlug?: string;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const active = node.slug === activeSlug;
        return (
          <li key={node.id}>
            <Link
              href={`/blog/category/${node.slug}`}
              aria-current={active ? "page" : undefined}
              style={{ paddingInlineStart: `${0.6 + depth * 0.85}rem` }}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md py-2 pe-2 text-sm transition-colors",
                active
                  ? "bg-[var(--reyhan-blue-50)] font-semibold text-[var(--reyhan-blue-700)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="min-w-0 truncate">{node.name}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                {toFaDigits(node.postCount)}
              </span>
            </Link>
            {node.children.length > 0 && (
              <CategoryListNode
                nodes={node.children}
                depth={depth + 1}
                activeSlug={activeSlug}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function BlogSidebar({
  categories,
  activeSlug,
  className,
}: {
  categories: BlogCategoryView[];
  activeSlug?: string;
  className?: string;
}) {
  if (categories.length === 0) return null;

  const total = categories.reduce((sum, c) => sum + c.postCount, 0);

  return (
    <nav aria-label="دسته‌بندی مقالات" className={cn("rounded-xl border bg-card p-4 shadow-card sm:p-5", className)}>
      <h2 className="mb-3 text-sm font-bold text-foreground">دسته‌بندی مقالات</h2>
      <CategoryListNode nodes={categories} depth={0} activeSlug={activeSlug} />
      <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        <Link
          href="/blog"
          className={cn(
            "font-medium transition-colors hover:text-[var(--reyhan-blue-700)]",
            !activeSlug && "text-[var(--reyhan-blue-700)]"
          )}
        >
          همه مقالات
        </Link>
        <span className="ms-2 tabular-nums">{toFaDigits(total)}</span>
      </div>
    </nav>
  );
}
