import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CatalogCategory } from "@/lib/catalog/types";
import { toFaDigits } from "@/lib/catalog/format";

export function CategoryCard({
  category,
}: {
  category: CatalogCategory;
}) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col rounded-xl border bg-card shadow-sm transition-all hover:shadow-md"
    >
      <div
        className={cn(
          "aspect-square overflow-hidden rounded-t-xl bg-muted",
          category.image && "bg-gradient-to-br from-[var(--reyhan-blue-50)] to-white"
        )}
      >
        {category.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.image}
            alt={category.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl text-muted-foreground" aria-hidden="true">💧</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-tight truncate">{category.name}</h3>
        {category.description && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-2">
            {category.description}
          </p>
        )}
        {category.productCount !== undefined && category.productCount > 0 && (
          <span className="mt-2 text-xs text-muted-foreground">
            {toFaDigits(category.productCount)} محصول
          </span>
        )}
      </div>
    </Link>
  );
}
