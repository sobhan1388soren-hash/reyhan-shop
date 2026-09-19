// Blog category administration domain — pure validation and hierarchy rules.
//
// Deliberately DB-free so it is unit-testable in a bare `node --test` process.
// The Prisma-backed service lives in ./service; server actions in
// src/app/actions/blog-categories.ts call the service, never these rules
// directly.
//
// Reuse policy: the product-catalog category rules
// (src/lib/admin/category-rules.ts) already implement EXACTLY the field shape
// a blog category needs (name/slug/parentId/description/image/status/sortOrder/
// seoTitle/seoDescription) plus cycle-safe hierarchy helpers that are generic
// over `{ id, parentId }`. Those are imported here rather than duplicated —
// one validation system, two category trees. Only the parts that genuinely
// differ (the deletion guard vocabulary and Persian copy, which must talk about
// articles rather than products) are blog-specific.

import {
  validateCategoryInput,
  validateParentAssignment,
  recomputeSubtreeLevels,
  buildCategoryTree,
  collectDescendantIds,
  normalizeCategorySlug,
  CATEGORY_STATUSES,
  toLatinDigits,
  parseStrictInt,
  type CategoryInputRaw,
  type NormalizedCategoryInput,
  type CategoryFieldErrors,
  type CategoryStatusValue,
  type CategoryStatus,
  type CategoryTreeNode,
  type FlatCategoryRow,
  type CategoryLevelRow,
} from "../admin/category-rules.ts";

// ── Re-exported pure primitives (shared with the catalog category system) ──

export {
  validateCategoryInput as validatePostCategoryInput,
  normalizeCategorySlug as normalizePostCategorySlug,
  validateParentAssignment,
  recomputeSubtreeLevels,
  buildCategoryTree as buildPostCategoryTree,
  collectDescendantIds as collectPostDescendantIds,
  CATEGORY_STATUSES as POST_CATEGORY_STATUSES,
  toLatinDigits,
  parseStrictInt,
};

export type {
  CategoryInputRaw as PostCategoryInputRaw,
  NormalizedCategoryInput as NormalizedPostCategoryInput,
  CategoryFieldErrors as PostCategoryFieldErrors,
  CategoryStatusValue as PostCategoryStatusValue,
  CategoryStatus,
  CategoryTreeNode as PostCategoryTreeNode,
  FlatCategoryRow as FlatPostCategoryRow,
  CategoryLevelRow as PostCategoryLevelRow,
};

// ── Shared admin view shape (client-importable; the service maps rows to it) ──

export type AdminPostCategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: CategoryStatusValue;
  sortOrder: number;
  level: number;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Posts assigned directly to this category, ANY status (drafts block deletion too). */
  postCount: number;
  /** Total posts in this subtree (self + descendants). */
  totalPostCount: number;
};

// ── Deletion guard (blog-specific vocabulary) ──────────────────────────────

export type PostCategoryDeleteBlockReason = "HAS_CHILDREN" | "HAS_POSTS";

export type PostCategoryDeleteEvaluation =
  | { allowed: true }
  | { allowed: false; reason: PostCategoryDeleteBlockReason };

/**
 * Conservative delete policy, mirroring the catalog category guard: a blog
 * category is only deletable when it has no child categories AND no published
 * or draft posts attached. Deactivation is always the safe alternative.
 */
export function evaluatePostCategoryDeletion(facts: {
  childCount: number;
  postCount: number;
}): PostCategoryDeleteEvaluation {
  if (facts.childCount > 0) return { allowed: false, reason: "HAS_CHILDREN" };
  if (facts.postCount > 0) return { allowed: false, reason: "HAS_POSTS" };
  return { allowed: true };
}

// ── Stable machine codes → Persian copy (never raw DB errors) ──────────────

export type PostCategoryErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "INVALID_PARENT"
  | "HAS_CHILDREN"
  | "HAS_POSTS"
  | "DB_ERROR";

export const POST_CATEGORY_ERROR_MESSAGES: Readonly<Record<PostCategoryErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "دسته‌بندی وبلاگ موردنظر یافت نشد.",
  DUPLICATE_SLUG: "این اسلاگ قبلاً استفاده شده است — مورد دیگری انتخاب کنید.",
  INVALID_PARENT: "والد انتخابی معتبر نیست؛ یک دسته‌بندی نمی‌تواند زیرمجموعه خودش یا فرزندان خود باشد.",
  HAS_CHILDREN: "این دسته‌بندی زیردسته دارد. ابتدا زیردسته‌ها را منتقل یا حذف کنید، یا آن را غیرفعال کنید.",
  HAS_POSTS: "مقالاتی به این دسته‌بندی متصل‌اند؛ حذف مجاز نیست. برای پنهان‌کردن آن را غیرفعال کنید.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};
