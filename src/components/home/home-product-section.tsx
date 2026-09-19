import { ProductCard } from "@/components/catalog/product-card";
import { HomeSectionHeading } from "@/components/home/section-heading";
import type { CatalogProduct } from "@/lib/catalog/types";

// HomeProductSection — heading + product grid for the homepage's curated
// selections (featured and best-selling). Reuses the existing ProductCard
// so price, availability badges and product URLs stay identical to the
// catalog. An empty list renders nothing: no fake placeholders, no
// fabricated popularity labels.

export function HomeProductSection({
  eyebrow,
  id,
  title,
  description,
  products,
  viewAllHref,
  viewAllLabel,
}: {
  eyebrow?: string;
  id?: string;
  title: string;
  description?: string;
  products: CatalogProduct[];
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby={id} className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeSectionHeading
          eyebrow={eyebrow}
          id={id}
          title={title}
          description={description}
          viewAllHref={viewAllHref}
          viewAllLabel={viewAllLabel}
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
