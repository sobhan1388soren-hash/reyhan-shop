// Homepage marketing domain — pure, DB-free and framework-free rules for
// the Phase 16 banner system (hero + promotional strip).
//
// Unit-testable in a bare `node --test` process (mirrors the admin rules
// modules). The Prisma-backed adapter lives in ./banner-service.ts and the
// server actions in src/app/actions/banners.ts; neither repeats this
// validation. The storefront UI never decides validity — server-side is
// authoritative.
//
// Security model:
//   - raw admin form values are normalized + whitelisted HERE before the
//     service touches Prisma (placement is allow-listed, URLs/links are
//     scheme-checked so `javascript:`/`data:`/protocol-relative never land
//     in a storefront href or src)
//   - the hero is a SINGLE active row; when none is active the storefront
//     renders factual structural defaults (no invented claims, no fake
//     metrics, no fabricated guarantees)
//   - empty optional CTA fields fall back to sensible internal paths, never
//     to fabricated contact details

import { isValidMediaUrl, cleanText, parseStrictInt, toLatinDigits } from "../admin/text.ts";

// ── Placements (mirrors the schema enum; kept literal so this module has
//    no Prisma dependency and stays unit-testable) ───────────────────────

export const BANNER_PLACEMENTS = ["HERO", "PROMO"] as const;
export type BannerPlacementValue = (typeof BANNER_PLACEMENTS)[number];

export function isBannerPlacement(value: string): value is BannerPlacementValue {
  return (BANNER_PLACEMENTS as readonly string[]).includes(value);
}

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacementValue, string> = {
  HERO: "هیرو صفحه اصلی",
  PROMO: "بنر تبلیغاتی",
};

// ── Field limits ────────────────────────────────────────────────────────

export const BANNER_TITLE_MAX = 120;
export const BANNER_DESCRIPTION_MAX = 600;
export const BANNER_LINK_LABEL_MAX = 60;
export const BANNER_LINK_HREF_MAX = 500;
export const BANNER_IMAGE_URL_MAX = 500;
export const BANNER_SORT_ORDER_MIN = -10_000;
export const BANNER_SORT_ORDER_MAX = 10_000;

/** Cap on PROMO banners rendered on the homepage (keeps the strip tidy). */
export const HOMEPAGE_PROMO_MAX = 3;
/** Featured/best-selling product counts shown on the homepage. */
export const HOMEPAGE_PRODUCTS_TAKE = 8;
/** Top-level categories shown on the homepage. */
export const HOMEPAGE_CATEGORIES_TAKE = 8;
/** Published posts shown on the homepage knowledge section. */
export const HOMEPAGE_POSTS_TAKE = 3;

// ── Hero fallback content ───────────────────────────────────────────────
// Structural, factual copy only: describes what the store actually
// contains (catalog categories + the knowledge center). No invented
// statistics, guarantees, certifications or experience claims.

export const HERO_DEFAULTS = {
  title: "تجهیزات تخصصی تصفیه آب خانگی",
  description:
    "دستگاه‌های تصفیه آب، فیلترهای جایگزین، قطعات یدکی و لوازم جانبی — همراه با مشاوره تخصصی و مقالات آموزشی.",
  primaryLinkLabel: "مشاهده محصولات",
  primaryLinkHref: "/products",
  secondaryLinkLabel: "مطالعه مقالات تخصصی",
  secondaryLinkHref: "/blog",
} as const;

// ── Input validation ────────────────────────────────────────────────────

export type BannerInputRaw = {
  placement?: unknown;
  title?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  primaryLinkHref?: unknown;
  primaryLinkLabel?: unknown;
  secondaryLinkHref?: unknown;
  secondaryLinkLabel?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
};

export type NormalizedBannerInput = {
  placement: BannerPlacementValue;
  title: string;
  description: string | null;
  imageUrl: string | null;
  primaryLinkHref: string | null;
  primaryLinkLabel: string | null;
  secondaryLinkHref: string | null;
  secondaryLinkLabel: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type BannerFieldErrors = Record<string, string>;
export type BannerValidation =
  | { ok: true; data: NormalizedBannerInput }
  | { ok: false; errors: BannerFieldErrors };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1";
}

/**
 * Link href policy — same shape as the media-URL policy: an absolute
 * http(s) URL or a root-relative path. Protocol-relative (`//host`) and
 * other schemes (`javascript:`, `data:`, `vbscript:`) are rejected so a
 * stored href can never become an injection vector on the storefront.
 */
export function isValidLinkHref(value: string): boolean {
  return isValidMediaUrl(value);
}

function optionalLink(raw: string): { value: string | null; invalid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, invalid: false };
  if (trimmed.length > BANNER_LINK_HREF_MAX) return { value: null, invalid: true };
  if (!isValidLinkHref(trimmed)) return { value: null, invalid: true };
  return { value: trimmed, invalid: false };
}

/** Validate + normalize the raw create/edit banner form. */
export function validateBannerInput(raw: BannerInputRaw): BannerValidation {
  const errors: BannerFieldErrors = {};

  const placementRaw = str(raw.placement).toUpperCase();
  const placement = isBannerPlacement(placementRaw) ? placementRaw : null;
  if (!placement) errors.placement = "محل نمایش بنر نامعتبر است.";

  const title = cleanText(str(raw.title));
  if (!title) errors.title = "عنوان بنر را وارد کنید.";
  else if (title.length > BANNER_TITLE_MAX) errors.title = "عنوان بنر خیلی بلند است.";

  const description = cleanText(str(raw.description));
  if (description.length > BANNER_DESCRIPTION_MAX) errors.description = "متن بنر خیلی بلند است.";

  const imageUrlRaw = str(raw.imageUrl).trim();
  let imageUrl: string | null = null;
  if (imageUrlRaw) {
    if (imageUrlRaw.length > BANNER_IMAGE_URL_MAX) {
      errors.imageUrl = "آدرس تصویر خیلی بلند است.";
    } else if (!isValidMediaUrl(imageUrlRaw)) {
      errors.imageUrl = "آدرس تصویر باید با http://، https:// یا / شروع شود.";
    } else {
      imageUrl = imageUrlRaw;
    }
  }

  const primaryHref = optionalLink(str(raw.primaryLinkHref));
  if (primaryHref.invalid) errors.primaryLinkHref = "نشانی لینک اصلی معتبر نیست.";
  const primaryLabel = cleanText(str(raw.primaryLinkLabel));
  if (primaryLabel.length > BANNER_LINK_LABEL_MAX) errors.primaryLinkLabel = "برچسب لینک اصلی خیلی بلند است.";

  const secondaryHref = optionalLink(str(raw.secondaryLinkHref));
  if (secondaryHref.invalid) errors.secondaryLinkHref = "نشانی لینک دوم معتبر نیست.";
  const secondaryLabel = cleanText(str(raw.secondaryLinkLabel));
  if (secondaryLabel.length > BANNER_LINK_LABEL_MAX) errors.secondaryLinkLabel = "برچسب لینک دوم خیلی بلند است.";

  // A link without a label (or vice versa) is not useful — pair them.
  if (primaryHref.value && !primaryLabel) errors.primaryLinkLabel = "برچسب لینک اصلی را وارد کنید.";
  if (!primaryHref.value && primaryLabel) errors.primaryLinkHref = "نشانی لینک اصلی را وارد کنید.";
  if (secondaryHref.value && !secondaryLabel) errors.secondaryLinkLabel = "برچسب لینک دوم را وارد کنید.";
  if (!secondaryHref.value && secondaryLabel) errors.secondaryLinkHref = "نشانی لینک دوم را وارد کنید.";

  const orderParsed = parseStrictInt(toLatinDigits(str(raw.sortOrder)));
  const sortOrder =
    orderParsed === null || orderParsed < BANNER_SORT_ORDER_MIN || orderParsed > BANNER_SORT_ORDER_MAX
      ? 0
      : orderParsed;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      placement: placement!,
      title,
      description: description || null,
      imageUrl,
      primaryLinkHref: primaryHref.value,
      primaryLinkLabel: primaryLabel || null,
      secondaryLinkHref: secondaryHref.value,
      secondaryLinkLabel: secondaryLabel || null,
      isActive: raw.isActive === undefined ? true : asBool(raw.isActive),
      sortOrder,
    },
  };
}

// ── Storefront hero resolution ──────────────────────────────────────────

export type HeroBannerRow = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  primaryLinkHref: string | null;
  primaryLinkLabel: string | null;
  secondaryLinkHref: string | null;
  secondaryLinkLabel: string | null;
};

export type HeroContentView = {
  title: string;
  description: string;
  imageUrl: string | null;
  primaryLinkLabel: string;
  primaryLinkHref: string;
  secondaryLinkLabel: string | null;
  secondaryLinkHref: string | null;
};

/**
 * Merge a stored active hero banner with the factual structural defaults.
 * `null` (no active hero) → the full default content; the homepage never
 * breaks and never invents claims. A stored row with empty optional CTAs
 * degrades to the default primary path and a null secondary action.
 */
export function resolveHeroContent(banner: HeroBannerRow | null): HeroContentView {
  if (!banner) {
    return {
      ...HERO_DEFAULTS,
      imageUrl: null,
      secondaryLinkLabel: HERO_DEFAULTS.secondaryLinkLabel,
      secondaryLinkHref: HERO_DEFAULTS.secondaryLinkHref,
    };
  }

  const primaryLinkLabel = banner.primaryLinkLabel?.trim() || HERO_DEFAULTS.primaryLinkLabel;
  const primaryLinkHref = banner.primaryLinkHref?.trim() || HERO_DEFAULTS.primaryLinkHref;
  const secondaryLinkLabel = banner.secondaryLinkLabel?.trim() || null;
  const secondaryLinkHref = banner.secondaryLinkHref?.trim() || null;

  return {
    title: banner.title.trim() || HERO_DEFAULTS.title,
    description: banner.description?.trim() || HERO_DEFAULTS.description,
    imageUrl: banner.imageUrl,
    primaryLinkLabel,
    primaryLinkHref,
    // A secondary CTA is only rendered when BOTH label and href exist.
    secondaryLinkLabel: secondaryLinkLabel && secondaryLinkHref ? secondaryLinkLabel : null,
    secondaryLinkHref: secondaryLinkLabel && secondaryLinkHref ? secondaryLinkHref : null,
  };
}

// ── Storefront promo banner view ────────────────────────────────────────

export type PromoBannerView = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkHref: string | null;
  linkLabel: string | null;
};

/**
 * Shape one stored PROMO row for the storefront strip. A promo without a
 * usable link still renders as an informational banner (linkHref null).
 */
export function toPromoBannerView(row: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  primaryLinkHref: string | null;
  primaryLinkLabel: string | null;
}): PromoBannerView {
  const linkLabel = row.primaryLinkLabel?.trim() || null;
  const linkHref = row.primaryLinkHref?.trim() || null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    linkLabel,
    linkHref,
  };
}

// ── Error vocabulary ────────────────────────────────────────────────────

export type BannerErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DB_ERROR";

export const BANNER_ERROR_MESSAGES: Readonly<Record<BannerErrorCode, string>> = {
  FORBIDDEN: "شما به مدیریت بنرها دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "بنر موردنظر یافت نشد.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};
