import { Container, Section } from "@/components/layout/container";
import { ProductGrid } from "@/components/catalog/product-grid";
import { EmptyState } from "@/components/catalog/empty-state";
import { SearchBar } from "@/components/catalog/search-bar";
import { SortSelect } from "@/components/catalog/sort-select";
import { FilterSidebar } from "@/components/catalog/filter-sidebar";
import { PaginationBar } from "@/components/catalog/pagination-bar";
import { getProductsPaginated, getAvailableSpecFilters } from "@/lib/catalog/queries";
import { parseCatalogSearchParams, catalogParamsToUrlSearch } from "@/lib/catalog/filtering";
import { parseSort } from "@/lib/catalog/sorting";
import { toFaDigits } from "@/lib/catalog/format";
import { buildMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";

// Live catalog data (Supabase/Postgres via Prisma, status: "ACTIVE" only) —
// never serve a stale build-time static cache on Cloudflare. Every request
// re-reads the database through getProductsPaginated().
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const params = parseCatalogSearchParams(resolved);
  // Filtered/search/paginated combinations canonicalize to the clean landing
  // page and are not indexed — the canonical landing page stays indexable.
  const hasFilters = Boolean(
    params.q || params.category || params.minPrice || params.maxPrice ||
      params.sort || (params.availability && params.availability.length > 0) ||
      (params.specs && Object.keys(params.specs).length > 0) || params.inStock ||
      (params.page && params.page > 1)
  );
  return buildMetadata({
    title: "محصولات",
    description:
      "خرید تجهیزات تصفیه آب خانگی — دستگاه‌ها، فیلترها، قطعات یدکی و لوازم جانبی.",
    path: "/products",
    type: "website",
    noindex: hasFilters,
  });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const params = parseCatalogSearchParams(resolved);
  const sort = parseSort(params.sort);

  const [result, specFilters] = await Promise.all([
    getProductsPaginated(params),
    getAvailableSpecFilters({ q: params.q, category: params.category, sort }),
  ]);

  const urlParams = catalogParamsToUrlSearch(params);

  return (
    <Section className="bg-gradient-to-b from-white via-[#f6fafc] to-[#eef3f6] py-10 sm:py-12">
      <Container>
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-widest text-[var(--reyhan-blue-600)]">فروشگاه ریحان</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#042e3a] sm:text-4xl">
            فروشگاه محصولات
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-7 text-muted-foreground sm:text-[15px]">
            خرید تجهیزات تصفیه آب خانگی — دستگاه‌ها، فیلترها، قطعات یدکی و لوازم جانبی.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_1fr]">
          <div className="space-y-6">
            <SearchBar placeholder="جستجوی محصولات…" basePath="/products" initQuery={params.q ?? ""} />
            <SortSelect basePath="/products" currentSort={sort} />
            <FilterSidebar
              filterOptions={specFilters}
              basePath="/products"
              searchParams={urlParams}
            />
          </div>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground" role="status">
              {toFaDigits(result.meta.total)}{" "}
              {result.meta.total === 1 ? "محصول" : "محصول"} یافت شد
              {params.q ? ` برای «${params.q}»` : ""}
            </p>
            {result.data.length > 0 ? (
              <>
                <ProductGrid products={result.data} />
                <PaginationBar
                  meta={result.meta}
                  basePath="/products"
                  searchParams={urlParams}
                />
              </>
            ) : (
              <EmptyState
                title="محصولی یافت نشد"
                description="محصولی با فیلترهای فعلی پیدا نشد. جستجو را تغییر دهید یا فیلترها را حذف کنید."
                actionHref="/products"
                actionLabel="مشاهده همه محصولات"
              />
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
