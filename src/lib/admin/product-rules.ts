// Product administration domain — pure validation, pricing, inventory and
// media rules (Phase 14, Part 1).
//
// Deliberately DB-free and server-only-free so it is unit-testable in a
// bare `node --test` process (mirroring category-rules/reviews/discounts).
// The Prisma-backed service lives in ./product-service; the server actions
// in src/app/actions/products.ts call the service, never these rules
// directly. The admin UI never decides validity — server-side is
// authoritative.
//
// Security model:
//   - every raw form value is normalized + whitelisted HERE before the
//     service touches Prisma (statuses/enums are allow-listed, numbers are
//     strictly parsed with Persian-digit tolerance, URLs are scheme-checked)
//   - money is accepted from the admin in Toman (the display currency) and
//     converted to Rial at the rules boundary; all stored values are Rial
//     and capped below the Postgres 32-bit INTEGER ceiling
//   - costPrice is ADMIN-only internal data (COST_PRICE_ROLES): the service
//     masks it for STAFF on read and ignores it on write
//   - publish/delete policies mirror the real schema constraints
//     (ProductPriceHistory only on real changes, onDelete: Restrict on
//     OrderItem) with admin-friendly Persian messaging
//
// No fake data and no invented fields: every field below exists on the
// current schema.

import {
  toLatinDigits,
  parseStrictInt,
  cleanText,
  normalizeSlug,
  isValidMediaUrl,
  parseMoneyTomanToRial,
  parseOptionalMoneyTomanToRial,
} from "./text.ts";

// ── Field limits (practical Persian content sizes + 32-bit safety) ─────

export const PRODUCT_TITLE_MAX = 200;
export const PRODUCT_SLUG_MAX = 200;
export const PRODUCT_SHORT_DESCRIPTION_MAX = 600;
export const PRODUCT_DESCRIPTION_MAX = 20_000;
export const PRODUCT_SEO_TITLE_MAX = 120;
export const PRODUCT_SEO_DESCRIPTION_MAX = 300;
export const PRODUCT_SEO_KEYWORDS_MAX = 500;

export const VARIANT_TITLE_MAX = 200;
export const VARIANT_SKU_MAX = 64;
export const VARIANT_BARCODE_MAX = 14;

export const SPEC_KEY_MAX = 120;
export const SPEC_VALUE_MAX = 2_000;

export const MEDIA_URL_MAX = 500;
export const MEDIA_ALT_MAX = 200;
export const MEDIA_MAX_PER_PRODUCT = 20;

export const PRODUCT_SORT_ORDER_MIN = -10_000;
export const PRODUCT_SORT_ORDER_MAX = 10_000;
export const WEIGHT_GRAMS_MAX = 1_000_000;

/**
 * Money ceilings. Postgres INTEGER is 32-bit signed, so stored Rial prices
 * must stay below 2,147,483,647. 200,000,000 Toman = 2,000,000,000 Rial is
 * the largest round Toman cap that fits safely.
 */
export const MAX_PRICE_TOMAN = 200_000_000;
export const MAX_PRICE_RIAL = MAX_PRICE_TOMAN * 10;

export const INVENTORY_QUANTITY_MAX = 1_000_000;
export const LOW_STOCK_THRESHOLD_MAX = 1_000_000;
export const INVENTORY_REASON_MAX = 200;
export const INVENTORY_REASON_MIN = 3;

export const MAX_PRODUCT_CATEGORIES = 20;

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

// ── Capability split (reuses the existing ADMIN/STAFF allow-list) ──────

/** Roles allowed to see/edit internal cost price. ADMIN only. */
export const COST_PRICE_ROLES: readonly string[] = ["ADMIN"];

export function canViewCostPrice(role: string): boolean {
  return COST_PRICE_ROLES.includes(role);
}

// ── Shared parsing ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1";
}

/** Parse a non-negative integer in Toman and convert to Rial. */
export function parseTomanToRial(raw: string): number | null {
  return parseMoneyTomanToRial(raw, MAX_PRICE_TOMAN);
}

/** Parse an optional Toman amount: empty → null; invalid → undefined. */
export function parseOptionalTomanToRial(raw: string): number | null | undefined {
  return parseOptionalMoneyTomanToRial(raw, MAX_PRICE_TOMAN);
}

function parseBoundedInt(
  raw: string,
  min: number,
  max: number
): number | null {
  const parsed = parseStrictInt(toLatinDigits(raw.trim()));
  if (parsed === null || parsed < min || parsed > max) return null;
  return parsed;
}

export function normalizeProductSlug(input: string): string {
  return normalizeSlug(input);
}

export const MEDIA_URL_MESSAGE = "آدرس رسانه باید با http://، https:// یا / شروع شود.";
export const MEDIA_URL_LENGTH_MESSAGE = "آدرس رسانه خیلی بلند است.";

// ─ Product core ──────────────────────────────────────────────────────

export type ProductInputRaw = {
  title?: unknown;
  slug?: unknown;
  status?: unknown;
  isFeatured?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  seoKeywords?: unknown;
  categoryIds?: unknown;
};

export type NormalizedProductInput = {
  title: string;
  slug: string;
  status: ProductStatusValue;
  isFeatured: boolean;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  categoryIds: string[];
};

export type FieldErrors = Record<string, string>;

export type Validation<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Accept an array or a single/comma-separated string; dedupe + cap. */
export function normalizeCategoryIds(raw: unknown): string[] {
  const list: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) if (typeof item === "string") list.push(item);
  } else if (typeof raw === "string") {
    list.push(...raw.split(","));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= MAX_PRODUCT_CATEGORIES) break;
  }
  return out;
}

export function validateProductInput(raw: ProductInputRaw): Validation<NormalizedProductInput> {
  const errors: FieldErrors = {};

  const title = cleanText(str(raw.title));
  if (!title) errors.title = "نام محصول را وارد کنید.";
  else if (title.length > PRODUCT_TITLE_MAX) errors.title = "نام محصول خیلی بلند است.";

  const slugInput = str(raw.slug).trim();
  let slug = normalizeProductSlug(slugInput);
  if (slugInput && !slug) errors.slug = "اسلاگ معتبر نیست — حروف مجاز استفاده کنید.";
  if (!slugInput) slug = normalizeProductSlug(title);
  if (!slug && !errors.slug) errors.slug = "اسلاگ معتبر نیست.";
  if (slug.length > PRODUCT_SLUG_MAX) errors.slug = "اسلاگ خیلی بلند است.";

  const statusRaw = str(raw.status).toUpperCase();
  let status: ProductStatusValue = "DRAFT";
  if (statusRaw) {
    if ((PRODUCT_STATUSES as readonly string[]).includes(statusRaw)) {
      status = statusRaw as ProductStatusValue;
    } else {
      errors.status = "وضعیت محصول نامعتبر است.";
    }
  }

  const shortDescription = cleanText(str(raw.shortDescription));
  if (shortDescription.length > PRODUCT_SHORT_DESCRIPTION_MAX)
    errors.shortDescription = "توضیح کوتاه خیلی بلند است.";

  const description = str(raw.description).replace(/\r\n/g, "\n").trim();
  if (description.length > PRODUCT_DESCRIPTION_MAX) errors.description = "توضیحات خیلی بلند است.";

  const seoTitle = cleanText(str(raw.seoTitle));
  if (seoTitle.length > PRODUCT_SEO_TITLE_MAX) errors.seoTitle = "عنوان سئو خیلی بلند است.";

  const seoDescription = cleanText(str(raw.seoDescription));
  if (seoDescription.length > PRODUCT_SEO_DESCRIPTION_MAX)
    errors.seoDescription = "توضیح سئو خیلی بلند است.";

  const seoKeywords = cleanText(str(raw.seoKeywords));
  if (seoKeywords.length > PRODUCT_SEO_KEYWORDS_MAX) errors.seoKeywords = "کلمات کلیدی خیلی بلند است.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title,
      slug,
      status,
      isFeatured: asBool(raw.isFeatured),
      shortDescription: shortDescription || null,
      description: description || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoKeywords: seoKeywords || null,
      categoryIds: normalizeCategoryIds(raw.categoryIds),
    },
  };
}

// ── Variant ────────────────────────────────────────────────────────────

export const SKU_PATTERN = /^[A-Za-z0-9._:\-]+$/;
export const BARCODE_PATTERN = /^[0-9]{8,14}$/;

export type VariantInputRaw = {
  title?: unknown;
  sku?: unknown;
  barcode?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  costPrice?: unknown;
  weight?: unknown;
  isDefault?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
};

export type NormalizedVariantInput = {
  title: string;
  sku: string;
  barcode: string | null;
  price: number; // Rial
  compareAtPrice: number | null; // Rial
  costPrice: number | null; // Rial (ADMIN-only)
  weight: number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function validateVariantInput(raw: VariantInputRaw): Validation<NormalizedVariantInput> {
  const errors: FieldErrors = {};

  const title = cleanText(str(raw.title));
  if (!title) errors.title = "عنوان گونه را وارد کنید.";
  else if (title.length > VARIANT_TITLE_MAX) errors.title = "عنوان گونه خیلی بلند است.";

  const sku = str(raw.sku).trim();
  if (!sku) errors.sku = "کد کالا (SKU) را وارد کنید.";
  else if (sku.length > VARIANT_SKU_MAX) errors.sku = "کد کالا خیلی بلند است.";
  else if (!SKU_PATTERN.test(sku))
    errors.sku = "کد کالا فقط میتواند شامل حروف انگلیسی، رقم و - _ . : باشد.";

  const barcodeRaw = str(raw.barcode).trim();
  let barcode: string | null = null;
  if (barcodeRaw) {
    if (!BARCODE_PATTERN.test(barcodeRaw))
      errors.barcode = "بارکد باید ۸ تا ۱۴ رقم باشد.";
    else barcode = barcodeRaw;
  }

  const price = parseTomanToRial(str(raw.price));
  if (price === null)
    errors.price = `قیمت را به تومان و در بازه مجاز وارد کنید (حداکثر ${MAX_PRICE_TOMAN.toLocaleString("en-US")} تومان).`;

  // compare-at is an optional display value; the storefront only renders it
  // when it exceeds the sale price, so no ordering constraint is imposed
  // here (least-restrictive validation — only shape is checked).
  const compareAt = parseOptionalTomanToRial(str(raw.compareAtPrice));
  if (compareAt === undefined) {
    errors.compareAtPrice = "قیمت خط‌خورده معتبر نیست.";
  }

  const costPrice = parseOptionalTomanToRial(str(raw.costPrice));
  if (costPrice === undefined) errors.costPrice = "قیمت تمامشده معتبر نیست.";

  let weight: number | null = null;
  const weightRaw = str(raw.weight).trim();
  if (weightRaw) {
    const parsed = parseBoundedInt(weightRaw, 0, WEIGHT_GRAMS_MAX);
    if (parsed === null) errors.weight = "وزن باید عددی بین ۰ تا ۱٬۰۰۰۰۰۰ گرم باشد.";
    else weight = parsed;
  }

  let sortOrder = 0;
  const sortRaw = str(raw.sortOrder).trim();
  if (sortRaw) {
    const parsed = parseBoundedInt(sortRaw, PRODUCT_SORT_ORDER_MIN, PRODUCT_SORT_ORDER_MAX);
    if (parsed === null) errors.sortOrder = "ترتیب نمایش خارج از بازه مجاز است.";
    else sortOrder = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title,
      sku,
      barcode,
      price: price!,
      compareAtPrice: compareAt ?? null,
      costPrice: costPrice ?? null,
      weight,
      isDefault: asBool(raw.isDefault),
      isActive: raw.isActive === undefined ? true : asBool(raw.isActive),
      sortOrder,
    },
  };
}

// ─ Price history ─────────────────────────────────────────────────────

export type PricePoint = { price: number; compareAtPrice: number | null };

/**
 * Price history is written ONLY when a relevant price value actually
 * changes. Returns null for a no-op update so the service never inserts
 * duplicate/useless history rows.
 */
export function derivePricePoint(prev: PricePoint, next: PricePoint): PricePoint | null {
  if (prev.price === next.price && prev.compareAtPrice === next.compareAtPrice) return null;
  return { price: next.price, compareAtPrice: next.compareAtPrice };
}

// ── Specifications ─────────────────────────────────────────────────────

export type SpecificationInputRaw = {
  key?: unknown;
  value?: unknown;
  sortOrder?: unknown;
};

export type NormalizedSpecificationInput = {
  key: string;
  value: string;
  sortOrder: number;
};

export function validateSpecificationInput(
  raw: SpecificationInputRaw
): Validation<NormalizedSpecificationInput> {
  const errors: FieldErrors = {};

  const key = cleanText(str(raw.key));
  if (!key) errors.key = "عنوان ویژگی را وارد کنید.";
  else if (key.length > SPEC_KEY_MAX) errors.key = "عنوان ویژگی خیلی بلند است.";

  const value = cleanText(str(raw.value));
  if (!value) errors.value = "مقدار ویژگی را وارد کنید.";
  else if (value.length > SPEC_VALUE_MAX) errors.value = "مقدار ویژگی خیلی بلند است.";

  let sortOrder = 0;
  const sortRaw = str(raw.sortOrder).trim();
  if (sortRaw) {
    const parsed = parseBoundedInt(sortRaw, PRODUCT_SORT_ORDER_MIN, PRODUCT_SORT_ORDER_MAX);
    if (parsed === null) errors.sortOrder = "ترتیب نمایش خارج از بازه مجاز است.";
    else sortOrder = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { key, value, sortOrder } };
}

/** Case-insensitive, whitespace-collapsed spec-key comparison. */
export function normalizeSpecKey(key: string): string {
  return cleanText(key).toLocaleLowerCase("fa-IR");
}

/**
 * Duplicate spec key prevention (the DB has @@unique([productId, key]) —
 * this mirrors it for admin-friendly messaging and case tolerance).
 * `excludeKey` lets an update ignore the row being edited.
 */
export function hasDuplicateSpecKey(
  existingKeys: string[],
  candidate: string,
  excludeKey?: string
): boolean {
  const target = normalizeSpecKey(candidate);
  const skip = excludeKey ? normalizeSpecKey(excludeKey) : null;
  for (const key of existingKeys) {
    const normalized = normalizeSpecKey(key);
    if (skip && normalized === skip) continue;
    if (normalized === target) return true;
  }
  return false;
}

// ── Media ─────────────────────────────────────────────────────────────

export type MediaInputRaw = {
  url?: unknown;
  alt?: unknown;
  sortOrder?: unknown;
  variantId?: unknown;
};

export type NormalizedMediaInput = {
  url: string;
  alt: string | null;
  sortOrder: number;
  variantId: string | null;
};

export function validateMediaInput(raw: MediaInputRaw): Validation<NormalizedMediaInput> {
  const errors: FieldErrors = {};

  const url = cleanText(str(raw.url));
  if (!url) errors.url = "آدرس رسانه را وارد کنید.";
  else if (url.length > MEDIA_URL_MAX) errors.url = MEDIA_URL_LENGTH_MESSAGE;
  else if (!isValidMediaUrl(url)) errors.url = MEDIA_URL_MESSAGE;

  const alt = cleanText(str(raw.alt));
  if (alt.length > MEDIA_ALT_MAX) errors.alt = "متن جایگزین خیلی بلند است.";

  let sortOrder = 0;
  const sortRaw = str(raw.sortOrder).trim();
  if (sortRaw) {
    const parsed = parseBoundedInt(sortRaw, PRODUCT_SORT_ORDER_MIN, PRODUCT_SORT_ORDER_MAX);
    if (parsed === null) errors.sortOrder = "ترتیب نمایش خارج از بازه مجاز است.";
    else sortOrder = parsed;
  }

  const variantId = cleanText(str(raw.variantId));

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { url, alt: alt || null, sortOrder, variantId: variantId || null },
  };
}

export type OrderedMedia = { id: string; sortOrder: number };

/**
 * Stable display order for product media. The PRIMARY image is simply the
 * first entry after ordering (the storefront uses `images[0]`); there is no
 * separate primary flag in the schema, so ordering is the single source.
 */
export function orderProductMedia<T extends OrderedMedia>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Next sortOrder when appending media (max + 1; empty → 0). */
export function nextMediaSortOrder(items: OrderedMedia[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.sortOrder)) + 1;
}

/**
 * Pure reorder used by "make primary": move `id` to the front and renumber
 * the whole list 0..n-1. Unknown ids return the list unchanged.
 */
export function moveMediaToFront(items: OrderedMedia[], id: string): OrderedMedia[] {
  const ordered = orderProductMedia(items);
  const index = ordered.findIndex((i) => i.id === id);
  if (index <= 0) return ordered.map((item, i) => ({ ...item, sortOrder: i }));
  const [moved] = ordered.splice(index, 1);
  ordered.unshift(moved);
  return ordered.map((item, i) => ({ ...item, sortOrder: i }));
}

export function canAddMedia(currentCount: number): boolean {
  return currentCount < MEDIA_MAX_PER_PRODUCT;
}

// ── Inventory ──────────────────────────────────────────────────────────

export const INVENTORY_MODES = ["RESTOCK", "ADJUSTMENT"] as const;
export type InventoryMode = (typeof INVENTORY_MODES)[number];

/** Default audit reason strings — the schema's reason column is free text. */
export const INVENTORY_REASON_RESTOCK = "RESTOCK";
export const INVENTORY_REASON_ADJUSTMENT = "ADJUSTMENT";

export type InventoryInputRaw = {
  mode?: unknown;
  amount?: unknown;
  reason?: unknown;
};

export type NormalizedInventoryInput = {
  mode: InventoryMode;
  /** Signed change applied to on-hand quantity. */
  delta: number;
  reason: string;
};

/**
 * Inventory policy:
 *   - RESTOCK adds a positive amount (reason optional; defaults to audit tag)
 *   - ADJUSTMENT applies a signed correction and REQUIRES a meaningful
 *     reason (≥ 3 characters) — manual corrections must be auditable
 */
export function validateInventoryInput(raw: InventoryInputRaw): Validation<NormalizedInventoryInput> {
  const errors: FieldErrors = {};

  const modeRaw = str(raw.mode).toUpperCase();
  const mode = (INVENTORY_MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as InventoryMode)
    : null;
  if (!mode) errors.mode = "نوع عملیات موجودی نامعتبر است.";

  const amountRaw = str(raw.amount).trim();
  const amount = amountRaw ? parseStrictInt(toLatinDigits(amountRaw)) : null;
  if (amount === null) {
    errors.amount = "مقدار باید یک عدد صحیح باشد.";
  } else if (Math.abs(amount) > INVENTORY_QUANTITY_MAX) {
    errors.amount = "مقدار خارج از بازه مجاز است.";
  } else if (mode === "RESTOCK" && amount <= 0) {
    errors.amount = "مقدار ورود باید بزرگتر از صفر باشد.";
  } else if (mode === "ADJUSTMENT" && amount === 0) {
    errors.amount = "مقدار اصلاح نمیتواند صفر باشد.";
  }

  const reason = cleanText(str(raw.reason));
  if (mode === "ADJUSTMENT") {
    if (reason.length < INVENTORY_REASON_MIN)
      errors.reason = "برای اصلاح دستی، دلیل معناداری وارد کنید (حداقل ۳ نویسه).";
    else if (reason.length > INVENTORY_REASON_MAX) errors.reason = "دلیل خیلی بلند است.";
  } else if (reason.length > INVENTORY_REASON_MAX) {
    errors.reason = "دلیل خیلی بلند است.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const delta = amount as number;
  return {
    ok: true,
    data: {
      mode: mode!,
      delta,
      reason: reason || (mode === "RESTOCK" ? INVENTORY_REASON_RESTOCK : INVENTORY_REASON_ADJUSTMENT),
    },
  };
}

export type InventoryState = { quantity: number; reservedQuantity: number };

export type InventoryApplyResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: "NEGATIVE" | "BELOW_RESERVED" };

/**
 * Apply a signed change to on-hand stock, preserving the reserved-orders
 * invariant: on-hand may never fall below the reserved quantity, and never
 * below zero.
 */
export function applyInventoryChange(state: InventoryState, delta: number): InventoryApplyResult {
  const next = state.quantity + delta;
  if (next < 0) return { ok: false, reason: "NEGATIVE" };
  if (next < state.reservedQuantity) return { ok: false, reason: "BELOW_RESERVED" };
  return { ok: true, quantity: next };
}

// ─ Publish / delete policies ──────────────────────────────────────────

export type PublishEvaluation = { allowed: true } | { allowed: false; reason: "NO_VARIANTS" };

/**
 * Advisory publish readiness check: a variant-less product is not
 * purchasable and the storefront will show it as «ناموجود». This is
 * INFORMATIONAL ONLY — activating a product is never blocked (the admin
 * may intentionally publish before adding variants), the UI simply warns.
 */
export function evaluateProductPublish(facts: { variantCount: number }): PublishEvaluation {
  if (facts.variantCount === 0) return { allowed: false, reason: "NO_VARIANTS" };
  return { allowed: true };
}

export type DeleteEvaluation = { allowed: true } | { allowed: false; reason: "HAS_ORDER_HISTORY" };

/** Products with order history are never hard-deleted (onDelete: Restrict). */
export function evaluateProductDeletion(facts: { orderItemCount: number }): DeleteEvaluation {
  if (facts.orderItemCount > 0) return { allowed: false, reason: "HAS_ORDER_HISTORY" };
  return { allowed: true };
}

export type VariantDeleteEvaluation =
  | { allowed: true }
  | { allowed: false; reason: "HAS_ORDER_HISTORY" | "IN_USE" };

/** Variants with order history or live carts stay; deactivate instead. */
export function evaluateVariantDeletion(facts: {
  orderItemCount: number;
  cartItemCount: number;
}): VariantDeleteEvaluation {
  if (facts.orderItemCount > 0) return { allowed: false, reason: "HAS_ORDER_HISTORY" };
  if (facts.cartItemCount > 0) return { allowed: false, reason: "IN_USE" };
  return { allowed: true };
}

// ── Stable machine codes → Persian copy (never raw DB errors) ──────────

export type ProductErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_SKU"
  | "DUPLICATE_BARCODE"
  | "DUPLICATE_SPEC_KEY"
  | "HAS_ORDER_HISTORY"
  | "IN_USE"
  | "INVALID_CATEGORY"
  | "INVALID_VARIANT"
  | "MEDIA_LIMIT"
  | "INVENTORY_BELOW_RESERVED"
  | "INVENTORY_NEGATIVE"
  | "DB_ERROR";

export const PRODUCT_ERROR_MESSAGES: Readonly<Record<ProductErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "محصول یا مورد درخواستی یافت نشد.",
  DUPLICATE_SLUG: "این اسلاگ قبلاً استفاده شده است — مورد دیگری انتخاب کنید.",
  DUPLICATE_SKU: "این کد کالا (SKU) قبلاً ثبت شده است.",
  DUPLICATE_BARCODE: "این بارکد قبلاً ثبت شده است.",
  DUPLICATE_SPEC_KEY: "این عنوان ویژگی برای این محصول قبلاً ثبت شده است.",
  HAS_ORDER_HISTORY: "این مورد در سفارشهای ثبتشده استفاده شده و حذف آن مجاز نیست؛ آن را غیرفعال یا آرشیو کنید.",
  IN_USE: "این مورد در سبد خرید مشتریان استفاده میشود؛ ابتدا آن را غیرفعال کنید.",
  INVALID_CATEGORY: "دستهبندی انتخابی معتبر نیست.",
  INVALID_VARIANT: "گونه انتخابی به این محصول تعلق ندارد.",
  MEDIA_LIMIT: `حداکثر ${MEDIA_MAX_PER_PRODUCT} رسانه برای هر محصول مجاز است.`,
  INVENTORY_BELOW_RESERVED:
    "موجودی نمیتواند کمتر از تعداد رزروشده سفارشهای در انتظار شود.",
  INVENTORY_NEGATIVE: "موجودی نمیتواند منفی شود.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};

export { parseStrictInt };