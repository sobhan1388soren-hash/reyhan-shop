"use server";

// Blog post management server actions — Phase 15.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default)
// and passes it to the service. The service validates + sanitizes
// everything; this layer only collects form values (including the repeated
// category/product id fields) and maps stable codes to Persian copy.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import { postStatusLabels } from "@/lib/admin/labels";
import type { PostStatus } from "@prisma/client";
import {
  createPost,
  updatePost,
  setPostStatus,
  deletePost,
} from "@/lib/blog/post-service";
import { POST_ERROR_MESSAGES } from "@/lib/blog/post-rules";
import type { PostErrorCode } from "@/lib/blog/post-rules";

export type PostActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Post id of the last successful write (lets the editor redirect to edit mode). */
  postId?: string;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(
  error: PostErrorCode,
  fieldErrors?: Record<string, string>
): PostActionState {
  return { error: POST_ERROR_MESSAGES[error], fieldErrors };
}

/**
 * Collect every value of a repeated field (checkbox list of ids). Form data
 * may send `categoryId` multiple times; getAll preserves the admin's order.
 */
function idList(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

function revalidateBlog(): void {
  revalidatePath("/admin/blog/posts");
  revalidatePath("/blog");
  revalidatePath("/blog/category");
  // The shop's product pages show related articles — keep them fresh.
  revalidatePath("/products");
}

function readInput(formData: FormData) {
  return {
    title: str(formData, "title"),
    slug: str(formData, "slug"),
    excerpt: str(formData, "excerpt"),
    content: str(formData, "content"),
    coverImage: str(formData, "coverImage"),
    status: str(formData, "status"),
    seoTitle: str(formData, "seoTitle"),
    seoDescription: str(formData, "seoDescription"),
    seoKeywords: str(formData, "seoKeywords"),
    authorId: str(formData, "authorId"),
  };
}

export async function createPostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const actor = await requireAdminForAction();
  const result = await createPost(
    actor,
    readInput(formData),
    idList(formData, "categoryId"),
    idList(formData, "productId")
  );
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlog();
  return { message: "مقاله ذخیره شد.", postId: result.data.id };
}

export async function updatePostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const actor = await requireAdminForAction();
  const postId = str(formData, "postId");
  if (!postId) return failure("VALIDATION");
  const result = await updatePost(
    actor,
    postId,
    readInput(formData),
    idList(formData, "categoryId"),
    idList(formData, "productId")
  );
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlog();
  return { message: "تغییرات مقاله ذخیره شد.", postId };
}

export async function setPostStatusAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const actor = await requireAdminForAction();
  const postId = str(formData, "postId");
  if (!postId) return failure("VALIDATION");
  const result = await setPostStatus(actor, postId, str(formData, "status"));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlog();
  return { message: `وضعیت مقاله: ${postStatusLabels[result.data.status as PostStatus]}`, postId };
}

export async function deletePostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const actor = await requireAdminForAction();
  const postId = str(formData, "postId");
  if (!postId) return failure("VALIDATION");
  const result = await deletePost(actor, postId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateBlog();
  return { message: "مقاله حذف شد." };
}
