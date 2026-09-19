import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminCategoryOptions } from "@/lib/admin/product-service";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { ProductForm, emptyProductDraft } from "@/components/admin/product-form";

export const metadata: Metadata = {
  title: "محصول جدید",
};

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await getAdminCategoryOptions();

  return (
    <div>
      <AdminPageHeader
        title="محصول جدید"
        description="ابتدا اطلاعات محصول را ثبت کنید؛ سپس گونه‌ها، قیمت، موجودی و تصاویر را مدیریت می‌کنید."
        actions={
          <Link
            href="/admin/products"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به محصولات
          </Link>
        }
      />

      {categories.state === "error" ? (
        <AdminListErrorState onRetryHref="/admin/products/new" />
      ) : (
        <ProductForm draft={emptyProductDraft} categories={categories.categories} />
      )}
    </div>
  );
}