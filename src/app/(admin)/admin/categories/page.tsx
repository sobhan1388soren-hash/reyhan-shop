import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminCategoryTree } from "@/lib/admin/category-service";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = {
  title: "دسته‌بندی‌ها",
};

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const result = await getAdminCategoryTree();

  return (
    <div>
      <AdminPageHeader
        title="دسته‌بندی‌ها"
        description="ساختار درختی دسته‌بندی‌های فروشگاه را بسازید و مدیریت کنید."
      />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <CategoryManager categories={result.categories} getCount={(c) => c.productCount} />
      )}
    </div>
  );
}
