import { HomeSectionHeading } from "@/components/home/section-heading";
import { CategoryCard } from "@/components/catalog/category-card";
import type { HomepageCategory } from "@/lib/marketing/homepage";

// HomeCategories — top-level active categories only (the curated homepage
// subset; the full tree lives on /products and the category pages). Reuses
// the existing CategoryCard so image fallback, URL structure and ordering
// stay identical to the rest of the storefront. An empty set renders
// nothing — never placeholder cards presented as real categories.

export function HomeCategories({ categories }: { categories: HomepageCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="home-categories-title" className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeSectionHeading
          eyebrow="دسته‌بندی‌ها"
          id="home-categories-title"
          title="خرید بر اساس دسته‌بندی"
          description="دسته‌بندی‌های تخصصی فروشگاه ریحان — از دستگاه تصفیه آب تا فیلترها و قطعات یدکی."
          viewAllHref="/products"
          viewAllLabel="مشاهده همه محصولات"
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}
