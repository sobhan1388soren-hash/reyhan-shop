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
    <Card className="group flex flex-col overflow-hidden rounded-xl border bg-card [perspective:1000px] perspective-1000 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:glow-lift hover:border-cyan-200/70 motion-safe:hover:rotate-x-1 motion-safe:hover:rotate-y-1">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted after:content-[''] after:pointer-events-none after:absolute after:inset-0 after:z-10 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:transition-transform after:duration-1000 after:ease-out motion-safe:hover:after:translate-x-full motion-safe:group-hover:after:translate-x-full motion-reduce:after:hidden">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.title}
              className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <MediaPlaceholder
              tone="blue"
              glyph="image"
              label={product.categories[0]?.name ?? "ریحان"}
            />
          )}
          <div className="absolute start-3 top-3">
            <ProductAvailability
              state={product.availability}
              size="sm"
              className="border-white/60 bg-white/75 shadow-[0_0_16px_-2px_rgb(34_211_238/0.5)] backdrop-blur-md"
            />
          </div>
          {!purchasable && (
            <div className="absolute inset-0 bg-white/55 backdrop-blur-[0.5px]" aria-hidden="true" />
          )}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        {product.categories.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {product.categories.slice(0, 2).map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="inline-flex rounded-full border border-white/60 bg-white/75 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-[0_0_16px_-2px_rgb(34_211_238/0.5)] backdrop-blur-md transition-colors hover:border-cyan-200/70 hover:bg-white/90 hover:text-[var(--reyhan-blue-700)]"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        <Link href={`/products/${product.slug}`} className="group/title">
          <h3 className="line-clamp-2 text-[14px] font-bold leading-5 text-foreground group-hover/title:text-[var(--reyhan-blue-700)] sm:text-[15px]">
            {product.title}
          </h3>
        </Link>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-muted-foreground">
            {product.shortDescription}
          </p>
        )}

        {product.specifications.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.specifications.slice(0, 3).map((spec) => (
              <Badge key={`${spec.key}-${spec.value}`} variant="outline" className="border bg-muted/40 px-2 py-0 text-[11px] font-normal text-muted-foreground">
                {spec.key}: {spec.value}
              </Badge>
            ))}
            {product.specifications.length > 3 && (
              <span className="inline-flex items-center text-[11px] text-muted-foreground">
                +{toFaDigits(product.specifications.length - 3)}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">شروع قیمت از</div>
            <div className="mt-0.5">
              <PriceRange min={product.priceRange.min} max={product.priceRange.max} />
            </div>
            {product.variants.length > 1 && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {toFaDigits(product.variants.length)} گزینه
              </div>
            )}
          </div>
          <Link
            href={`/products/${product.slug}`}
            aria-disabled={!purchasable}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-[#042e3a] px-3.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-[#083f52] hover:shadow-[0_8px_24px_-6px_rgba(14,165,200,0.5)] disabled:pointer-events-none disabled:opacity-50"
          >
            مشاهده
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
