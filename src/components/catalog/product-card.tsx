import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/common/media-placeholder";
import { ProductAvailability } from "@/components/catalog/product-availability";
import { PriceRange } from "@/components/catalog/price";
import type { CatalogProduct } from "@/lib/catalog/types";
import { isPurchasable } from "@/lib/catalog/availability";
import { toFaDigits } from "@/lib/catalog/format";

// Product card — medical clean, Blue/Green/White, Persian-ready logical props
// No fake data; shows empty states when images/specs missing

export function ProductCard({ product }: { product: CatalogProduct }) {
  const primaryImage = product.images[0];
  const purchasable = isPurchasable(product.availability);

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* Image placeholder — keeps aspect ratio, ready for Next Image later */}
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <MediaPlaceholder
              tone="blue"
              glyph="image"
              label={product.categories[0]?.name ?? "ریحان"}
            />
          )}
          {/* Availability overlay */}
          <div className="absolute start-3 top-3">
            <ProductAvailability state={product.availability} size="sm" />
          </div>
          {!purchasable && (
            <div className="absolute inset-0 bg-white/55 backdrop-blur-[0.5px]" aria-hidden="true" />
          )}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        {/* Categories */}
        {product.categories.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.categories.slice(0, 2).map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        <Link href={`/products/${product.slug}`} className="group/title">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground group-hover/title:text-[var(--reyhan-blue-700)] sm:text-[15px]">
            {product.title}
          </h3>
        </Link>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {product.shortDescription}
          </p>
        )}

        {/* Specs preview — extensible */}
        {product.specifications.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.specifications.slice(0, 3).map((spec) => (
              <Badge key={`${spec.key}-${spec.value}`} variant="outline" className="px-2 py-0 text-[11px] font-normal">
                {spec.key}: {spec.value}
              </Badge>
            ))}
            {product.specifications.length > 3 && (
              <span className="inline-flex items-center text-[11px] text-muted-foreground">
                +{product.specifications.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <div className="text-xs text-muted-foreground">شروع قیمت از</div>
            <PriceRange min={product.priceRange.min} max={product.priceRange.max} />
            {product.variants.length > 1 && (
              <div className="text-[11px] text-muted-foreground">
                {toFaDigits(product.variants.length)} گزینه
              </div>
            )}
          </div>
          <Link
            href={`/products/${product.slug}`}
            aria-disabled={!purchasable}
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:pointer-events-none disabled:opacity-50"
          >
            مشاهده
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
