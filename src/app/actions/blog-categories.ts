"use server";

// Blog category management server actions — Phase 15.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default)
// and passes it to the service; roles and ids from form data are never
// trusted. The service performs the authoritative validation.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import {
  createPostCategory,
  updatePostCategory,
  setPostCategoryStatus,
  deletePostCategory,
} from "@/lib/blog/category-service";
import { POST_CATEGORY_ERROR_MESSAGES } from "@/lib/blog/category-rules";
import type { PostCategoryErrorCode } from "@/lib/blog/category-rules";

export type PostCategoryActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(
  error: PostCategoryErrorCode,
  fieldErrors?: Record<string, string>
): PostCategoryActionState {
  return { error: POST_CATEGORY_ERROR_MESSAGES[error], fieldErrors };
}

function revalidateBlogCategories(): void {
  revalidatePath("/admin/blog/categories");
  // Blog category content feeds the public blog landing + category pages.
  revalidatePath("/blog");
  revalidatePath("/blog/category");
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

export async function createPostCategoryAction(
  _prev: PostCategoryActionState,
  formData: FormData
): Promise<PostCategoryActionState> {
  const actor = await requireAdminForAction();
  const result = await createPostCategory(actor, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlogCategories();
  return { message: "دسته‌بندی مقالات ساخته شد." };
}

export async function updatePostCategoryAction(
  _prev: PostCategoryActionState,
  formData: FormData
): Promise<PostCategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await updatePostCategory(actor, categoryId, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlogCategories();
  return { message: "دسته‌بندی مقالات به‌روزرسانی شد." };
}

export async function setPostCategoryStatusAction(
  _prev: PostCategoryActionState,
  formData: FormData
): Promise<PostCategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await setPostCategoryStatus(actor, categoryId, str(formData, "status"));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlogCategories();
  return {
    message:
      result.data.status === "ACTIVE"
        ? "دسته‌بندی فعال شد و در بخش مقالات نمایش داده می‌شود."
        : "دسته‌بندی غیرفعال شد و از بخش مقالات پنهان می‌گردد.",
  };
}

export async function deletePostCategoryAction(
  _prev: PostCategoryActionState,
  formData: FormData
): Promise<PostCategoryActionState> {
  const actor = await requireAdminForAction();
  const categoryId = str(formData, "categoryId");
  if (!categoryId) return failure("VALIDATION");
  const result = await deletePostCategory(actor, categoryId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlogCategories();
  return { message: "دسته‌بندی مقالات حذف شد." };
}
