import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Section } from "@/components/layout/container";
import { ProductGrid } from "@/components/catalog/product-grid";
import { EmptyState } from "@/components/catalog/empty-state";
import { CategoryBreadcrumb } from "@/components/catalog/category-breadcrumb";
import { CategoryCard } from "@/components/catalog/category-card";
import { PaginationBar } from "@/components/catalog/pagination-bar";
import { SearchBar } from "@/components/catalog/search-bar";
import { SortSelect } from "@/components/catalog/sort-select";
import { FilterSidebar } from "@/components/catalog/filter-sidebar";
import {
  getCategoryBySlug,
  getCategoryAncestors,
  getCategoryChildren,
  getCategoryDescendantIds,
  getProductsPaginated,
  getAvailableSpecFilters,
} from "@/lib/catalog/queries";
import { parseCatalogSearchParams, catalogParamsToUrlSearch } from "@/lib/catalog/filtering";
import { parseSort } from "@/lib/catalog/sorting";
import { toFaDigits } from "@/lib/catalog/format";

type PageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return { title: "دسته‌بندی یافت نشد" };
  return {
    title: category.name,
    description: category.description ?? `خرید محصولات دسته «${category.name}».`,
    alternates: {
      canonical: `/categories/${category.slug}`,
    },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const [{ categorySlug }, resolvedSearch] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(categorySlug);

  if (!category || category.status !== "ACTIVE") {
    notFound();
  }

  const catalogParams = parseCatalogSearchParams(resolvedSearch, {
    categoryPath: undefined,
  });
  // Scope product query to this category (includes descendants)
  const scopedParams = { ...catalogParams, category: category.slug };
  const sort = parseSort(scopedParams.sort);

  const [ancestors, children, descendantIds, result, specFilters] = await Promise.all([
    getCategoryAncestors(category.id),
    getCategoryChildren(category.id),
    getCategoryDescendantIds(category.id),
    getProductsPaginated(scopedParams),
    getAvailableSpecFilters({ q: scopedParams.q, category: category.slug, sort }),
  ]);

  void descendantIds;
  const urlParams = catalogParamsToUrlSearch(scopedParams);
  const basePath = `/categories/${category.slug}`;

  return (
    <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-12 sm:py-16 lg:py-20">
      <Container>
        <CategoryBreadcrumb ancestors={ancestors} />
        <div className="mx-auto mt-4 mb-10 max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
              {category.description}
            </p>
          )}
        </div>

        {children.length > 0 && (
          <div className="mx-auto mb-10 max-w-7xl">
            <h2 className="mb-4 text-sm font-semibold text-foreground">زیردسته‌ها</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {children.map((child) => (
                <CategoryCard key={child.id} category={child} />
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_1fr]">
          <div className="space-y-6">
            <SearchBar placeholder="جستجو در این دسته…" basePath={basePath} initQuery={scopedParams.q ?? ""} />
            <SortSelect basePath={basePath} currentSort={sort} />
            <FilterSidebar
              filterOptions={specFilters}
              basePath={basePath}
              searchParams={urlParams}
            />
          </div>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground" role="status">
              {toFaDigits(result.meta.total)}{" "}
              {result.meta.total === 1 ? "محصول" : "محصول"} در «{category.name}»
            </p>
            {result.data.length > 0 ? (
              <>
                <ProductGrid products={result.data} />
                <PaginationBar meta={result.meta} basePath={basePath} searchParams={urlParams} />
              </>
            ) : (
              <EmptyState
                title="محصولی در این دسته یافت نشد"
                description="محصولی با فیلترهای فعلی در این دسته وجود ندارد. فیلترها را تغییر دهید یا همه محصولات را ببینید."
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
