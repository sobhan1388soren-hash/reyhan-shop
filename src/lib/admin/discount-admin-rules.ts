// Discount administration domain — pure validation for the admin UI
// (Phase 14, Part 2).
//
// This module does NOT re-implement any discount calculation or eligibility
// logic — that single source of truth stays in src/lib/discounts/rules.ts
// and src/lib/discounts/service.ts. Here we only normalize/validate the raw
// admin form input (codes, type, money, limits, dates) before the existing
// discount service persists it.
//
// Money is entered in Toman and stored in Rial, capped below the Postgres
// 32-bit INTEGER ceiling.

import type { DiscountType } from "@prisma/client";
import { normalizeDiscountCode } from "../checkout/discount.ts";
import {
  parseStrictInt,
  parseDateInput,
  parseMoneyTomanToRial,
  parseOptionalMoneyTomanToRial,
} from "./text.ts";

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] as const;
export type DiscountTypeValue = (typeof DISCOUNT_TYPES)[number];

/** Shared with the product pricing cap — largest round Toman value that
 * still fits a 32-bit Rial Int. */
export const MAX_DISCOUNT_TOMAN = 200_000_000;
export const DISCOUNT_CODE_MAX = 64;
export const DISCOUNT_MAX_USES = 1_000_000_000;
export const DISCOUNT_MAX_USES_PER_USER = 1_000_000;

export function isDiscountType(value: string): value is DiscountTypeValue {
  return (DISCOUNT_TYPES as readonly string[]).includes(value);
}

export type DiscountAdminInputRaw = {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  minOrderAmount?: unknown;
  maxDiscountAmount?: unknown;
  maxUses?: unknown;
  maxUsesPerUser?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  isActive?: unknown;
};

export type NormalizedDiscountAdminInput = {
  code: string;
  type: DiscountTypeValue;
  /** Rial for FIXED_AMOUNT, percent (1-100) for PERCENTAGE, 0 for FREE_SHIPPING. */
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type FieldErrors = Record<string, string>;
export type DiscountAdminValidation =
  | { ok: true; data: NormalizedDiscountAdminInput }
  | { ok: false; errors: FieldErrors };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1";
}

function parseOptionalCount(
  raw: string,
  max: number
): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parseStrictInt(trimmed);
  if (parsed === null || parsed < 1 || parsed > max) return undefined;
  return parsed;
}

/** Validate + normalize the raw create/edit discount form. */
export function validateDiscountAdminInput(
  raw: DiscountAdminInputRaw
): DiscountAdminValidation {
  const errors: FieldErrors = {};

  const rawCode = str(raw.code).trim();
  const code = normalizeDiscountCode(rawCode);
  if (!code) errors.code = "کد تخفیف را وارد کنید.";
  else if (rawCode.length > DISCOUNT_CODE_MAX) errors.code = "کد تخفیف خیلی بلند است.";

  const typeRaw = str(raw.type).toUpperCase();
  const type = isDiscountType(typeRaw) ? typeRaw : null;
  if (!type) errors.type = "نوع تخفیف نامعتبر است.";

  // ── value (type-dependent) ───────────────────────────────────────────
  let value = 0;
  if (type === "PERCENTAGE") {
    const parsed = parseStrictInt(str(raw.value));
    if (parsed === null || parsed < 1 || parsed > 100) {
      errors.value = "درصد تخفیف باید عددی بین ۱ تا ۱۰۰ باشد.";
    } else {
      value = parsed;
    }
  } else if (type === "FIXED_AMOUNT") {
    const parsed = parseMoneyTomanToRial(str(raw.value), MAX_DISCOUNT_TOMAN);
    if (parsed === null || parsed <= 0) {
      errors.value = "مبلغ تخفیف را به تومان و بزرگ‌تر از صفر وارد کنید.";
    } else {
      value = parsed;
    }
  } else if (type === "FREE_SHIPPING") {
    value = 0;
  }

  // ── optional money limits ────────────────────────────────────────────
  const minOrderAmount = parseOptionalMoneyTomanToRial(str(raw.minOrderAmount), MAX_DISCOUNT_TOMAN);
  if (minOrderAmount === undefined) {
    errors.minOrderAmount = "حداقل مبلغ سفارش معتبر نیست.";
  }

  const maxDiscountAmount = parseOptionalMoneyTomanToRial(
    str(raw.maxDiscountAmount),
    MAX_DISCOUNT_TOMAN
  );
  if (maxDiscountAmount === undefined) {
    errors.maxDiscountAmount = "سقف تخفیف معتبر نیست.";
  }

  // ── usage limits ─────────────────────────────────────────────────────
  const maxUses = parseOptionalCount(str(raw.maxUses), DISCOUNT_MAX_USES);
  if (maxUses === undefined) errors.maxUses = "سقف کل استفاده باید عددی بزرگ‌تر از صفر باشد.";

  const maxUsesPerUser = parseOptionalCount(str(raw.maxUsesPerUser), DISCOUNT_MAX_USES_PER_USER);
  if (maxUsesPerUser === undefined)
    errors.maxUsesPerUser = "سقف استفاده هر کاربر باید عددی بزرگ‌تر از صفر باشد.";

  // ── validity window ──────────────────────────────────────────────────
  const startsAt = parseDateInput(str(raw.startsAt));
  if (startsAt === undefined) errors.startsAt = "تاریخ شروع معتبر نیست.";

  const endsAt = parseDateInput(str(raw.endsAt));
  if (endsAt === undefined) errors.endsAt = "تاریخ پایان معتبر نیست.";

  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAt = "تاریخ پایان باید بعد از تاریخ شروع باشد.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      code,
      type: type!,
      value,
      minOrderAmount: minOrderAmount ?? null,
      maxDiscountAmount: maxDiscountAmount ?? null,
      maxUses: maxUses ?? null,
      maxUsesPerUser: maxUsesPerUser ?? null,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      isActive: raw.isActive === undefined ? true : asBool(raw.isActive),
    },
  };
}

/** Runtime status for a discount row (admin list badge). */
export function derivedDiscountStatus(row: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  now?: Date;
}): "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE" {
  const now = row.now ?? new Date();
  if (!row.isActive) return "INACTIVE";
  if (row.startsAt && now.getTime() < row.startsAt.getTime()) return "SCHEDULED";
  if (row.endsAt && now.getTime() > row.endsAt.getTime()) return "EXPIRED";
  return "ACTIVE";
}

export type DiscountAdminErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "DB_ERROR";

export const DISCOUNT_ADMIN_MESSAGES: Readonly<Record<DiscountAdminErrorCode, string>> = {
  FORBIDDEN: "شما به مدیریت تخفیف‌ها دسترسی ندارید.",
  VALIDATION: "اطلاعات وارد شده معتبر نیست.",
  NOT_FOUND: "کد تخفیف موردنظر یافت نشد.",
  DUPLICATE_CODE: "این کد تخفیف قبلاً ثبت شده است — کد دیگری انتخاب کنید.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};

/** Re-export the schema enum type for callers mapping service rows. */
export type { DiscountType };