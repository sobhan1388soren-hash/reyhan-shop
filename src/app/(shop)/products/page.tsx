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
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "محصولات",
  description: "خرید تجهیزات تصفیه آب خانگی — دستگاه‌ها، فیلترها، قطعات یدکی و لوازم جانبی.",
};

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
    <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            فروشگاه محصولات
          </h1>
          <p className="mt-3 text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
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
