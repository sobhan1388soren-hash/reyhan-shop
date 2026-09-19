import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminPostCategoryTree } from "@/lib/blog/category-service";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import {
  CategoryManager,
  type CategoryManagerActions,
  type CategoryManagerLabels,
} from "@/components/admin/category-manager";
import {
  createPostCategoryAction,
  updatePostCategoryAction,
  setPostCategoryStatusAction,
  deletePostCategoryAction,
} from "@/app/actions/blog-categories";

export const metadata: Metadata = {
  title: "دسته‌بندی مقالات",
};

// Blog-specific copy for the shared category manager — same UI system as
// the catalog tree, talking about articles instead of products.
const blogCategoryLabels: CategoryManagerLabels = {
  treeTitle: "ساختار دسته‌بندی مقالات",
  rootButton: "دسته‌بندی ریشه جدید",
  emptyTitle: "هنوز دسته‌بندی مقاله‌ای ساخته نشده است",
  emptyDescription:
    "با «دسته‌بندی ریشه جدید» اولین دسته‌بندی بخش مقالات را بسازید. زیردسته‌ها را بعداً از همان‌جا اضافه می‌کنید.",
  emptyAction: "ساخت دسته‌بندی",
  selectPrompt: "یک دسته‌بندی را انتخاب کنید",
  selectPromptHint:
    "روی نام هر دسته‌بندی در فهرست بزنید تا جزئیات و عملیات آن اینجا نمایش داده شود.",
  itemsLabel: "مقالات متصل",
  itemNoun: "مقاله",
  deleteBlockedChildren:
    "این دسته‌بندی زیردسته دارد و قابل حذف نیست. ابتدا زیردسته‌ها را منتقل کنید یا همین‌جا غیرفعالش کنید.",
  deleteBlockedItems:
    "مقالاتی به این دسته‌بندی متصل‌اند؛ حذف مجاز نیست. برای پنهان‌کردن از بخش مقالات آن را غیرفعال کنید.",
  editTitle: "ویرایش دسته‌بندی",
  addChild: "افزودن زیردسته",
};

// The blog category actions share the common action-state contract
// (message/error/fieldErrors), so they slot into the shared manager.
const blogCategoryActions: CategoryManagerActions = {
  create: createPostCategoryAction,
  update: updatePostCategoryAction,
  setStatus: setPostCategoryStatusAction,
  delete: deletePostCategoryAction,
};

export default async function AdminBlogCategoriesPage() {
  await requireAdmin();
  const result = await getAdminPostCategoryTree();

  return (
    <div>
      <AdminPageHeader
        title="دسته‌بندی مقالات"
        description="ساختار درختی دسته‌بندی‌های بخش مقالات را بسازید و مدیریت کنید."
      />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <CategoryManager
          categories={result.categories}
          getCount={(c) => c.postCount}
          actions={blogCategoryActions}
          labels={blogCategoryLabels}
        />
      )}
    </div>
  );
}
