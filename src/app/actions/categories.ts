"use server";

// Category management server actions — Phase 14-B.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default)
// and passes it to the service; roles and ids from form data are never
// trusted. The service performs the authoritative validation.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import {
  createCategory,
  updateCategory,
  setCategoryStatus,
  deleteCategory,
} from "@/lib/admin/category-service";
import type { CategoryErrorCode } from "@/lib/admin/category-rules";
import { CATEGORY_ERROR_MESSAGES } from "@/lib/admin/category-rules";

export type CategoryActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(error: CategoryErrorCode, fieldErrors?: Record<string, string>): CategoryActionState {
  return { error: CATEGORY_ERROR_MESSAGES[error], fieldErrors };
}

function revalidateCategories(): void {
  revalidatePath("/admin/categories");
  // Category content feeds public catalog landing pages + nav.
  revalidatePath("/categories");
  revalidatePath("/products");
}

function readInput(formData: FormData) {
  return {
    name: str(formData, "name"),
    slug: str(formData, "slug"),
    parentId: str(formData, "parentId"),
    description: str(formData, "description"),
    image: str(formData, "image"),
    status: str(formData, "status"),
    sortOrder: str(formData, "sortOrder"),
    seoTitle: str(formData, "seoTitle"),
    seoDescription: str(formData, "seoDescription"),
  };
}

export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const actor = await requireAdminForAction();
  const result = await createCategory(actor, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateCategories();
  return { message: "دسته‌بندی با موفقیت ساخته شد." };
}

export async function updateCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await updateCategory(actor, categoryId, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateCategories();
  return { message: "دسته‌بندی به‌روزرسانی شد." };
}

export async function setCategoryStatusAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await setCategoryStatus(actor, categoryId, str(formData, "status"));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateCategories();
  return {
    message:
      result.data.status === "ACTIVE"
        ? "دسته‌بندی فعال شد و در فروشگاه نمایش داده می‌شود."
        : "دسته‌بندی غیرفعال شد و از فروشگاه پنهان می‌گردد.",
  };
}

export async function deleteCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await deleteCategory(actor, categoryId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateCategories();
  return { message: "دسته‌بندی حذف شد." };
}
