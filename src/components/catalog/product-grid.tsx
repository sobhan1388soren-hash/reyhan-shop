import { ProductCard } from "@/components/catalog/product-card";
import { EmptyState } from "@/components/catalog/empty-state";
import type { CatalogProduct } from "@/lib/catalog/types";

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (!products.length) {
    return (
      <EmptyState
        title="محصولی یافت نشد"
        description="محصولی با فیلترهای فعلی پیدا نشد. فیلترها را تغییر دهید یا همه محصولات را ببینید."
        actionHref="/products"
        actionLabel="مشاهده همه محصولات"
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border bg-card p-4">
          <div className="aspect-[4/3] rounded-lg bg-muted" />
          <div className="mt-4 h-4 rounded bg-muted" />
          <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
          <div className="mt-4 h-8 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
