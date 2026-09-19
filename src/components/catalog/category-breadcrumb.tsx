import Link from "next/link";
import type { CatalogCategory } from "@/lib/catalog/types";

export function CategoryBreadcrumb({
  ancestors,
}: {
  ancestors: CatalogCategory[];
}) {
  if (ancestors.length === 0) return null;

  return (
    <nav aria-label="مسیر صفحه" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Link href="/categories" className="hover:text-foreground transition-colors">
        دسته‌بندی‌ها
      </Link>
      {ancestors.map((cat, i) => (
        <span key={cat.id} className="flex items-center gap-1.5">
          <span aria-hidden="true">/</span>
          {i < ancestors.length - 1 ? (
            <Link
              href={`/categories/${cat.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {cat.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground" aria-current="page">
              {cat.name}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
