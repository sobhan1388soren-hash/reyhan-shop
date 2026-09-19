import { ProductCard } from "@/components/catalog/product-card";
import type { CatalogProduct } from "@/lib/catalog/types";

export function RelatedProducts({ products }: { products: CatalogProduct[] }) {
  if (!products.length) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        <h3 className="mb-3 text-lg font-semibold text-foreground">محصولات مرتبط</h3>
        <p>محصولات مکملی برای این کالا ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-foreground">
        محصولات مرتبط
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
