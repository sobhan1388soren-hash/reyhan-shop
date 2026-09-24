import Link from "next/link";
import type { BlogArticle } from "@/lib/blog/queries";
import { formatPriceToman } from "@/lib/catalog/format";

// ArticleRelatedProducts — the manually linked catalog products for an
// article (editorial selection, no recommendation engine). Only real,
// ACTIVE products reach this list (the public query filters on product
// status), and prices come from live variants.

export function ArticleRelatedProducts({ post }: { post: BlogArticle }) {
  if (post.relatedProducts.length === 0) return null;

  return (
    <section aria-label="محصولات مرتبط" className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-primary" fill="none">
          <path
            d="M2.5 5.5h11l-1 7h-9z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M5.5 5.5a2.5 2.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        محصولات مرتبط با این مقاله
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {post.relatedProducts.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group flex items-center gap-3.5 overflow-hidden rounded-xl border bg-card p-3 shadow-card transition-all hover:border-[var(--reyhan-blue-200)] hover:shadow-md"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={product.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--reyhan-blue-50)] to-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 text-primary/50" fill="none">
                    <path
                      d="M7 16C7 16 9 14 10.5 12C12 10 13.5 8 15 6.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 18C12 18 12.5 14.5 14 12C15.5 9.5 18 7 18 7"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-[var(--reyhan-blue-700)]">
                {product.title}
              </h3>
              {product.shortDescription && (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {product.shortDescription}
                </p>
              )}
              <p className="mt-1.5 text-sm font-bold tabular-nums text-[var(--reyhan-blue-700)]">
                {formatPriceToman(product.priceMin)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
