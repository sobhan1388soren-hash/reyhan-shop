import { Container, Section } from "@/components/layout/container";
import { CategoryCard } from "@/components/catalog/category-card";
import { getCategoryTree } from "@/lib/catalog/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "دسته‌بندی محصولات",
  description: "دسته‌بندی محصولات تصفیه آب خانگی ریحان.",
  path: "/categories",
  type: "website",
});

export default async function CategoriesPage() {
  const categories = await getCategoryTree();

  return (
    <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            دسته‌بندی محصولات
          </h1>
          <p className="mt-3 text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
            دسته‌بندی محصولات تصفیه آب خانگی ریحان.
          </p>
        </div>

        <div className="mx-auto max-w-7xl">
          {categories.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              هنوز دسته‌بندی‌ای ثبت نشده است. به‌زودی محصولات ریحان در این بخش عرضه می‌شوند.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
