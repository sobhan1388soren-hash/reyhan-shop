// Phone validation & normalization — Iranian mobile numbers
// Normalized storage format: 98912xxxxxxx (no plus sign)

import type { Prisma } from "@prisma/client";

export type PhoneValidation = { ok: true; phone: string } | { ok: false; error: string };

/**
 * Accepts: 09121234567, +989121234567, 00989121234567, 989121234567, 9121234567
 * Normalizes to 989121234567.
 */
export function normalizePhone(input: string): PhoneValidation {
  const trimmed = input.trim().replace(/[\s\u200c\u200f\u200e-]/g, "");
  if (!trimmed) return { ok: false, error: "شماره موبایل را وارد کنید." };

  let digits = trimmed.replace(/^\+/, "").replace(/^00/, "");
  if (/^0\d{10}$/.test(digits)) digits = digits.slice(1); // 0912… -> 912…
  if (/^9\d{9}$/.test(digits)) digits = `98${digits}`; // 912… -> 98912…

  if (!/^989\d{9}$/.test(digits)) {
    return { ok: false, error: "شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹" };
  }
  return { ok: true, phone: digits };
}

/** Format for display: ۰۹۱۲ ۱۲۳ ۴۵۶۷ */
export function formatPhoneForDisplay(phone: string): string {
  if (!/^989\d{9}$/.test(phone)) return phone;
  const local = `0${phone.slice(2)}`; // 09121234567
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

// ── Profile field validation ──────────────────────────────────────────

export type FieldValidation = { ok: true; value: string } | { ok: false; error: string };

export function validateOptionalName(value: string | undefined | null): FieldValidation {
  if (!value || !value.trim()) return { ok: true, value: "" };
  const trimmed = value.trim();
  if (trimmed.length < 2) return { ok: false, error: "نام باید حداقل ۲ نویسه باشد." };
  if (trimmed.length > 60) return { ok: false, error: "نام نمی‌تواند بیش از ۶۰ نویسه باشد." };
  return { ok: true, value: trimmed };
}

export function validateOptionalEmail(value: string | undefined | null): FieldValidation {
  if (!value || !value.trim()) return { ok: true, value: "" };
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, error: "نشانی ایمیل معتبر نیست." };
  }
  return { ok: true, value: trimmed };
}

export function validatePostalCode(value: string | undefined | null): FieldValidation {
  if (!value || !value.trim()) return { ok: true, value: "" };
  const trimmed = value.trim().replace(/[\s\u200c-]/g, "");
  if (!/^\d{10}$/.test(trimmed)) {
    return { ok: false, error: "کد پستی باید ۱۰ رقم باشد." };
  }
  return { ok: true, value: trimmed };
}

// ── Address DTO validation ───────────────────────────────────────────

export type AddressInput = {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode?: string;
  addressLine: string;
};

export type AddressValidation =
  | { ok: true; data: AddressInput }
  | { ok: false; errors: Partial<Record<keyof AddressInput, string>> };

export function validateAddressInput(raw: {
  recipientName?: unknown;
  phone?: unknown;
  province?: unknown;
  city?: unknown;
  postalCode?: unknown;
  addressLine?: unknown;
}): AddressValidation {
  const errors: Partial<Record<keyof AddressInput, string>> = {};

  const recipientName = typeof raw.recipientName === "string" ? raw.recipientName.trim() : "";
  if (recipientName.length < 2 || recipientName.length > 80) {
    errors.recipientName = "نام گیرنده را کامل وارد کنید (حداقل ۲ نویسه).";
  }

  const phoneCheck = normalizePhone(typeof raw.phone === "string" ? raw.phone : "");
  if (!phoneCheck.ok) errors.phone = phoneCheck.error;

  const province = typeof raw.province === "string" ? raw.province.trim() : "";
  if (province.length < 2) errors.province = "استان را وارد کنید.";

  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  if (city.length < 2) errors.city = "شهر را وارد کنید.";

  let postalCode = "";
  if (typeof raw.postalCode === "string" && raw.postalCode.trim()) {
    const postalCheck = validatePostalCode(raw.postalCode);
    if (!postalCheck.ok) {
      errors.postalCode = postalCheck.error;
    } else {
      postalCode = postalCheck.value;
    }
  }

  const addressLine = typeof raw.addressLine === "string" ? raw.addressLine.trim() : "";
  if (addressLine.length < 10) {
    errors.addressLine = "نشانی کامل را وارد کنید (حداقل ۱۰ نویسه).";
  } else if (addressLine.length > 500) {
    errors.addressLine = "نشانی نمی‌تواند بیش از ۵۰۰ نویسه باشد.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const phone = phoneCheck.ok ? phoneCheck.phone : "";
  return {
    ok: true,
    data: {
      recipientName,
      phone,
      province,
      city,
      postalCode: postalCode || undefined,
      addressLine,
    },
  };
}

/** Safe Prisma user where-clause fragment by phone. */
export function phoneWhere(phone: string): Prisma.UserWhereInput {
  return { phone };
}
