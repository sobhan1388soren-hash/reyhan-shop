// Blog post administration domain — pure validation and status rules.
//
// DB-free and framework-free so it is unit-testable in a bare `node --test`
// process, mirroring the catalog/admin rules modules. The Prisma-backed
// service lives in ./service.ts; the server actions in
// src/app/actions/blog-posts.ts call the service, never these rules
// directly. The UI never decides validity — server-side is authoritative.
//
// Security model:
//   - title/slug/excerpt/SEO strings are length-capped and whitespace-
//     normalized here (Postgres TEXT is unbounded; the caps are ours)
//   - rich content is passed through the pure allowlist sanitizer in
//     ./content.ts BEFORE it is written; nothing unsanitized is ever stored
//     or rendered
//   - cover-image URLs use the shared media URL policy (http(s) or root path)
//   - category/related-product ids are re-validated against real rows inside
//     the write transaction by the service (forged ids never reach Prisma)
//   - publish readiness is decided here: a post without real content cannot
//     be published; drafts may be saved at any completeness

import { cleanText, isValidMediaUrl, normalizeSlug, parseStrictInt } from "../admin/text.ts";
import { sanitizeHtml } from "./content.ts";

// ── Field limits ───────────────────────────────────────────────────────────

export const POST_TITLE_MAX = 200;
export const POST_SLUG_MAX = 200;
export const POST_EXCERPT_MAX = 600;
export const POST_CONTENT_MAX = 100_000;
export const POST_SEO_TITLE_MAX = 200;
export const POST_SEO_DESCRIPTION_MAX = 400;
export const POST_SEO_KEYWORDS_MAX = 300;
export const POST_COVER_IMAGE_MAX = 500;
export const POST_CATEGORIES_MAX = 3;
export const POST_RELATED_PRODUCTS_MAX = 8;
export const POST_SORT_ORDER_MIN = -10_000;
export const POST_SORT_ORDER_MAX = 10_000;

export const POST_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PostStatusValue = (typeof POST_STATUSES)[number];

export const POST_SORTS = [
  "published_desc",
  "published_asc",
  "updated_desc",
  "created_desc",
  "title_asc",
  "title_desc",
] as const;
export type PostSort = (typeof POST_SORTS)[number];

// ── Input shape (raw client values — `unknown` at the edges) ───────────────

export type PostInputRaw = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  content?: unknown;
  coverImage?: unknown;
  status?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  seoKeywords?: unknown;
  authorId?: unknown;
  /** Update only. */
  postId?: unknown;
};

export type NormalizedPostInput = {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: PostStatusValue;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  authorId: string | null;
};

export type PostFieldErrors = Record<string, string>;

export type PostInputValidation =
  | { ok: true; data: NormalizedPostInput }
  | { ok: false; errors: PostFieldErrors };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Normalize a post slug through the shared catalog convention. */
export function normalizePostSlug(input: string): string {
  return normalizeSlug(input);
}

/**
 * Validate + normalize the raw admin form input.
 * Content is sanitized here so a rule violation can never also be an XSS.
 */
export function validatePostInput(raw: PostInputRaw): PostInputValidation {
  const errors: PostFieldErrors = {};

  const title = cleanText(str(raw.title));
  if (!title) errors.title = "عنوان مقاله را وارد کنید.";
  else if (title.length > POST_TITLE_MAX)
    errors.title = "عنوان نمی‌تواند بیش از ۲۰۰ نویسه باشد.";

  // Empty slug falls back to the title; an explicit-but-junk slug errors out.
  const slugInput = str(raw.slug).trim();
  let slug = normalizePostSlug(slugInput);
  if (slugInput && !slug) errors.slug = "اسلاگ معتبر نیست — حروف مجاز استفاده کنید.";
  if (!slugInput) slug = normalizePostSlug(title);
  if (!slug && !errors.slug) errors.slug = "اسلاگ معتبر نیست.";
  if (slug.length > POST_SLUG_MAX) errors.slug = "اسلاگ خیلی بلند است — کوتاه‌ترش کنید.";

  const excerpt = cleanText(str(raw.excerpt));
  if (excerpt.length > POST_EXCERPT_MAX)
    errors.excerpt = "خلاصه مقاله خیلی بلند است.";

  // Rich content: pure allowlist rewrite on the way in. Always a string.
  const content = sanitizeHtml(str(raw.content));
  if (content.length > POST_CONTENT_MAX) errors.content = "محتوای مقاله خیلی طولانی است.";

  const coverImage = cleanText(str(raw.coverImage));
  if (coverImage && !isValidMediaUrl(coverImage))
    errors.coverImage = "آدرس تصویر باید با http://، https:// یا / شروع شود.";
  if (coverImage.length > POST_COVER_IMAGE_MAX) errors.coverImage = "آدرس تصویر خیلی بلند است.";

  const statusRaw = str(raw.status).toUpperCase();
  const status: PostStatusValue = (POST_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as PostStatusValue)
    : "DRAFT";
  if (str(raw.status) && !(POST_STATUSES as readonly string[]).includes(statusRaw))
    errors.status = "وضعیت نامعتبر است.";

  // Publishing requires real content; drafts may be saved at any stage.
  if (status === "PUBLISHED") {
    const prose = content.replace(/<[^>]*>/g, "").trim();
    if (!prose) errors.content = "برای انتشار، ابتدا محتوای مقاله را بنویسید.";
  }

  const seoTitle = cleanText(str(raw.seoTitle));
  if (seoTitle.length > POST_SEO_TITLE_MAX)
    errors.seoTitle = "عنوان سئو نباید بیش از ۲۰۰ نویسه باشد.";

  const seoDescription = cleanText(str(raw.seoDescription));
  if (seoDescription.length > POST_SEO_DESCRIPTION_MAX)
    errors.seoDescription = "توضیح سئو نباید بیش از ۴۰۰ نویسه باشد.";

  const seoKeywords = cleanText(str(raw.seoKeywords));
  if (seoKeywords.length > POST_SEO_KEYWORDS_MAX)
    errors.seoKeywords = "کلمات کلیدی خیلی بلند است.";

  const authorId = cleanText(str(raw.authorId)) || null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      coverImage: coverImage || null,
      status,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoKeywords: seoKeywords || null,
      authorId,
    },
  };
}

// ── Related-product id list (raw client values) ────────────────────────────

export type RelatedProductsValidation =
  | { ok: true; ids: string[] }
  | { ok: false; error: "DUPLICATE" | "TOO_MANY" };

/** De-duplicate and cap the admin-selected product ids (order preserved). */
export function normalizeRelatedProductIds(raw: unknown): RelatedProductsValidation {
  const list = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  let duplicate = false;
  for (const id of list) {
    const value = id.trim();
    if (seen.has(value)) {
      duplicate = true;
      continue;
    }
    seen.add(value);
    ids.push(value);
  }
  if (ids.length > POST_RELATED_PRODUCTS_MAX) return { ok: false, error: "TOO_MANY" };
  if (duplicate) return { ok: false, error: "DUPLICATE" };
  return { ok: true, ids };
}

// ── Category id list ───────────────────────────────────────────────────────

export function normalizePostCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string") continue;
    const value = id.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  return ids.slice(0, POST_CATEGORIES_MAX);
}

// ── Publication date ───────────────────────────────────────────────────────

/**
 * publishedAt is set the first time a post is published and PRESERVED when it
 * returns to draft (re-publishing keeps its original date, mirroring the
 * product catalog behavior). Only a never-published post gets a fresh stamp.
 */
export function publishFieldFor(
  status: PostStatusValue,
  existingPublishedAt: Date | null
): Date | null {
  if (status !== "PUBLISHED") return existingPublishedAt;
  return existingPublishedAt ?? new Date();
}

// ── Deletion guard ─────────────────────────────────────────────────────────

export type PostDeleteEvaluation = { allowed: true };

/**
 * A post carries no dependent business records (category/product links
 * cascade), so deletion is always available. Kept as an explicit pure
 * function so future guards have one place to live.
 */
export function evaluatePostDeletion(): PostDeleteEvaluation {
  return { allowed: true };
}

// ── Sort option parsing helper (whitelist-only, shared by service + page) ───

export function parsePostSort(value: string | undefined): PostSort {
  if (value && (POST_SORTS as readonly string[]).includes(value)) {
    return value as PostSort;
  }
  return "published_desc";
}

// ── Stable machine codes → Persian copy (never raw DB errors) ──────────────

export type PostErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "INVALID_CATEGORY"
  | "INVALID_PRODUCTS"
  | "INVALID_AUTHOR"
  | "PRODUCT_LIMIT"
  | "DB_ERROR";

export const POST_ERROR_MESSAGES: Readonly<Record<PostErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "مقاله موردنظر یافت نشد.",
  DUPLICATE_SLUG: "این اسلاگ قبلاً استفاده شده است — مورد دیگری انتخاب کنید.",
  INVALID_CATEGORY: "یک یا چند دسته‌بندی انتخابی معتبر نیست.",
  INVALID_PRODUCTS: "یک یا چند محصول انتخابی وجود ندارد.",
  INVALID_AUTHOR: "نویسنده انتخاب شده معتبر نیست.",
  PRODUCT_LIMIT: `حداکثر ${toFaDigitsLocal(POST_RELATED_PRODUCTS_MAX)} محصول قابل اتصال به هر مقاله است.`,
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};

function toFaDigitsLocal(input: number): string {
  const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => faDigits[Number(d)]);
}

// Re-exported for the admin form's numeric input handling.
export { parseStrictInt };
