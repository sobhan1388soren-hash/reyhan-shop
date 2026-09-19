// Category administration domain — pure validation and hierarchy rules.
//
// This module is deliberately DB-free and server-only-free so it is unit-
// testable in a bare `node --test` process (mirroring reviews/discounts).
// The Prisma-backed service lives in ./service; the server actions in
// src/app/actions/categories.ts call the service, never these rules
// directly. The UI never decides validity — server-side is authoritative.
//
// Security model:
//   - slug/parent/sort values arrive as strings from the client and are
//     normalized + whitelisted HERE before the service touches Prisma
//   - hierarchy edits are validated against the REAL database shape: a
//     category may never become its own parent or a child of its own
//     descendant (cycle prevention happens before any write)
//   - deletion is guarded: categories with children or product
//     associations are refused with a clear reason (the schema itself
//     uses onDelete: Restrict — the guard mirrors it with admin-friendly
//     messaging and guides toward deactivation)

// Field limits — matched to practical Persian content sizes (no schema
// String fields are unbounded in Postgres, so the caps are ours).
export const CATEGORY_NAME_MAX = 120;
export const CATEGORY_SLUG_MAX = 160;
export const CATEGORY_DESCRIPTION_MAX = 2000;
export const CATEGORY_IMAGE_MAX = 500;
export const CATEGORY_SEO_TITLE_MAX = 120;
export const CATEGORY_SEO_DESCRIPTION_MAX = 300;
export const CATEGORY_SORT_ORDER_MIN = -10_000;
export const CATEGORY_SORT_ORDER_MAX = 10_000;

export const CATEGORY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CategoryStatusValue = (typeof CATEGORY_STATUSES)[number];

// ─ Persian/Arabic digit tolerance (shared primitives in ./text) ───────
// Re-exported so existing category callers/tests keep their import site.
import { toLatinDigits, parseStrictInt, normalizeSlug, isValidMediaUrl, cleanText } from "./text.ts";
export { toLatinDigits, parseStrictInt };

/** Category slugs use the shared catalog-convention slug normalizer. */
export function normalizeCategorySlug(input: string): string {
  return normalizeSlug(input);
}

// ── Validation ──────────────────────────────────────────────────────────

export type CategoryInputRaw = {
  name?: unknown;
  slug?: unknown;
  parentId?: unknown;
  description?: unknown;
  image?: unknown;
  status?: unknown;
  sortOrder?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  /** Update only: current id (a category may parent itself away only from others). */
  categoryId?: unknown;
  /** Current parent (update only) — lets the service skip no-op reparent work. */
  currentParentId?: unknown;
};

export type NormalizedCategoryInput = {
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  image: string | null;
  status: CategoryStatusValue;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type CategoryFieldErrors = Record<string, string>;

export type CategoryInputValidation =
  | { ok: true; data: NormalizedCategoryInput }
  | { ok: false; errors: CategoryFieldErrors };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Collapse inner whitespace, trim. */
function clean(input: string): string {
  return cleanText(input);
}

function isValidImageUrl(value: string): boolean {
  return isValidMediaUrl(value);
}

/**
 * Validate and normalize the raw admin form input for create/update.
 * Pure: parent EXISTENCE and CYCLE safety are checked separately against
 * the live DB rows (validateParentAssignment); this covers shape only.
 */
export function validateCategoryInput(raw: CategoryInputRaw): CategoryInputValidation {
  const errors: CategoryFieldErrors = {};

  const name = clean(str(raw.name));
  if (!name) errors.name = "نام دسته‌بندی را وارد کنید.";
  else if (name.length > CATEGORY_NAME_MAX)
    errors.name = "نام نمی‌تواند بیش از ۱۲۰ نویسه باشد.";

  // Explicit-but-junk slugs error out; an empty slug falls back to the name.
  const slugInput = str(raw.slug).trim();
  let slug = normalizeCategorySlug(slugInput);
  if (slugInput && !slug) errors.slug = "اسلاگ معتبر نیست — حروف مجاز استفاده کنید.";
  if (!slugInput) slug = normalizeCategorySlug(name);
  if (!slug && !errors.slug) errors.slug = "اسلاگ معتبر نیست.";
  if (slug.length > CATEGORY_SLUG_MAX)
    errors.slug = "اسلاگ خیلی بلند است — کوتاه‌ترش کنید.";

  const rawParent = clean(str(raw.parentId));
  const parentId = rawParent && rawParent !== "none" && rawParent !== "0" ? rawParent : null;

  const description = clean(str(raw.description));
  if (description.length > CATEGORY_DESCRIPTION_MAX)
    errors.description = "توضیحات خیلی بلند است.";

  const image = clean(str(raw.image));
  if (image && !isValidImageUrl(image))
    errors.image = "آدرس تصویر باید با http://، https:// یا / شروع شود.";
  if (image.length > CATEGORY_IMAGE_MAX) errors.image = "آدرس تصویر خیلی بلند است.";

  const statusRaw = str(raw.status).toUpperCase();
  const status: CategoryStatusValue =
    statusRaw === "INACTIVE" ? "INACTIVE" : statusRaw === "ACTIVE" ? "ACTIVE" : "ACTIVE";
  if (str(raw.status) && statusRaw !== "ACTIVE" && statusRaw !== "INACTIVE")
    errors.status = "وضعیت نامعتبر است.";

  let sortOrder = 0;
  const sortRaw = str(raw.sortOrder).trim();
  if (sortRaw) {
    const parsed = parseStrictInt(sortRaw);
    if (parsed === null) errors.sortOrder = "ترتیب نمایش باید یک عدد صحیح باشد.";
    else if (parsed < CATEGORY_SORT_ORDER_MIN || parsed > CATEGORY_SORT_ORDER_MAX)
      errors.sortOrder = "ترتیب نمایش خارج از بازه مجاز است.";
    else sortOrder = parsed;
  }

  const seoTitle = clean(str(raw.seoTitle));
  if (seoTitle.length > CATEGORY_SEO_TITLE_MAX)
    errors.seoTitle = "عنوان سئو نباید بیش از ۱۲۰ نویسه باشد.";

  const seoDescription = clean(str(raw.seoDescription));
  if (seoDescription.length > CATEGORY_SEO_DESCRIPTION_MAX)
    errors.seoDescription = "توضیح سئو نباید بیش از ۳۰۰ نویسه باشد.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      slug,
      parentId,
      description: description || null,
      image: image || null,
      status,
      sortOrder,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
    },
  };
}

// ── Hierarchy (pure, over the flat DB rows) ────────────────────────────

export type FlatCategoryRow = {
  id: string;
  parentId: string | null;
};

/** All descendant ids of `id` (cycle-safe BFS over the flat parent map). */
export function collectDescendantIds(rows: FlatCategoryRow[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (row.parentId == null) continue;
    const list = childrenOf.get(row.parentId) ?? [];
    list.push(row.id);
    childrenOf.set(row.parentId, list);
  }
  const out = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const child of childrenOf.get(parent) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        queue.push(child);
      }
    }
  }
  return out;
}

export type ParentViolation = "SELF" | "DESCENDANT" | "UNKNOWN_PARENT";

/**
 * Build a forest from flat rows (each row gets a `children` array, in the
 * input order — callers pass rows already sorted by level/sortOrder/name).
 * A row whose parent is not present in the set is treated as a root
 * (defensive; shouldn't happen with consistent data).
 */
export type CategoryTreeNode<T> = T & { children: CategoryTreeNode<T>[] };

export function buildCategoryTree<T extends FlatCategoryRow>(rows: T[]): CategoryTreeNode<T>[] {
  const map = new Map<string, CategoryTreeNode<T>>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });
  const roots: CategoryTreeNode<T>[] = [];
  for (const node of map.values()) {
    const parent = node.parentId != null ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * Decide whether assigning `newParentId` to `selfId` is hierarchy-safe,
 * given the CURRENT flat rows. null = valid. The service additionally
 * proves the parent exists in the DB (UNKNOWN covers forged ids here).
 */
export function validateParentAssignment(
  rows: FlatCategoryRow[],
  selfId: string,
  newParentId: string | null
): ParentViolation | null {
  if (newParentId === null) return null;
  if (newParentId === selfId) return "SELF";
  const known = rows.some((r) => r.id === newParentId);
  if (!known) return "UNKNOWN_PARENT";
  const descendants = collectDescendantIds(rows, selfId);
  if (descendants.has(newParentId)) return "DESCENDANT";
  return null;
}

export type CategoryLevelRow = FlatCategoryRow & { level: number };/**
 * Recompute levels for the subtree rooted at `rootId` after a parent
 * change (level of root becomes newLevel; each child = parent + 1).
 * Returns only the rows whose level actually changes.
 */
export function recomputeSubtreeLevels(
  rows: CategoryLevelRow[],
  rootId: string,
  newLevel: number
): { id: string; level: number }[] {
  const childrenOf = new Map<string, CategoryLevelRow[]>();
  const byId = new Map<string, CategoryLevelRow>();
  for (const row of rows) {
    byId.set(row.id, row);
    if (row.parentId == null) continue;
    const arr = childrenOf.get(row.parentId) ?? [];
    arr.push(row);
    childrenOf.set(row.parentId, arr);
  }
  const root = byId.get(rootId);
  if (!root) return [];
  const changes: { id: string; level: number }[] = [];
  const queue: { id: string; level: number }[] = [{ id: rootId, level: newLevel }];
  while (queue.length) {
    const { id, level } = queue.shift()!;
    const row = byId.get(id);
    if (!row) continue;
    if (row.level !== level) changes.push({ id, level });
    for (const child of childrenOf.get(id) ?? []) {
      queue.push({ id: child.id, level: level + 1 });
    }
  }
  return changes;
}

// ── Shared admin view shape (client-importable; service maps rows to it) ─

export type CategoryStatus = "ACTIVE" | "INACTIVE";

export type AdminCategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: CategoryStatus;
  sortOrder: number;
  level: number;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
};

// ── Deletion guard ──────────────────────────────────────────────────────
export type DeleteBlockReason = "HAS_CHILDREN" | "HAS_PRODUCTS";

export type DeleteEvaluation = { allowed: true } | { allowed: false; reason: DeleteBlockReason };

/**
 * Conservative delete policy: a category is only deletable when it has no
 * child categories AND no product associations. Deactivation is always
 * available as the safe alternative (messages below guide the admin).
 */
export function evaluateCategoryDeletion(facts: {
  childCount: number;
  productCount: number;
}): DeleteEvaluation {
  if (facts.childCount > 0) return { allowed: false, reason: "HAS_CHILDREN" };
  if (facts.productCount > 0) return { allowed: false, reason: "HAS_PRODUCTS" };
  return { allowed: true };
}

// ── Stable machine codes → Persian copy (never raw DB errors) ──────────

export type CategoryErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "INVALID_PARENT"
  | "HAS_CHILDREN"
  | "HAS_PRODUCTS"
  | "DB_ERROR";

export const CATEGORY_ERROR_MESSAGES: Readonly<Record<CategoryErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "دسته‌بندی موردنظر یافت نشد.",
  DUPLICATE_SLUG: "این اسلاگ قبلاً استفاده شده است — مورد دیگری انتخاب کنید.",
  INVALID_PARENT: "والد انتخابی معتبر نیست؛ یک دسته‌بندی نمی‌تواند زیرمجموعه خودش یا فرزندان خود باشد.",
  HAS_CHILDREN: "این دسته‌بندی فرزند دارد. ابتدا زیردسته‌ها را منتقل یا حذف کنید، یا آن را غیرفعال کنید.",
  HAS_PRODUCTS: "محصولاتی به این دسته‌بندی متصل‌اند؛ حذف مجاز نیست. در صورت نیاز آن را غیرفعال کنید.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};
