// Discount-code input handling — pure, Phase 12.
// No server-only imports, no Prisma, no Next: the same normalization rules
// are used by the checkout action, final validation, and the unit tests.
// Evaluation itself lives in the server-side discount service
// (src/lib/discounts/**) against live DB rows — never client input.

import type { CheckoutDiscountState } from "./types";

/** Normalized no-discount state used by snapshots and cleared previews. */
export const NO_DISCOUNT_STATE: CheckoutDiscountState = {
  code: "",
  amount: 0,
  applied: false,
  message: null,
  freeShipping: false,
};

/** Persian error shown when a user tries to stack multiple codes. */
export const DISCOUNT_STACK_MESSAGE =
  "در هر سفارش فقط یک کد تخفیف قابل اعمال است.";

/** Maximum length of a normalized discount code. */
export const DISCOUNT_CODE_MAX_LENGTH = 64;

/**
 * Normalize a raw discount code: trim, collapse inner whitespace, cap the
 * length. Codes are stored/matched case-insensitively (see
 * normalizeDiscountCodeForKey); the display form preserves the user's case.
 */
export function normalizeDiscountCode(rawCode: unknown): string {
  if (typeof rawCode !== "string") return "";
  return rawCode
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DISCOUNT_CODE_MAX_LENGTH);
}

/**
 * Case-insensitive lookup key for a discount code. Codes with equal
 * upper-case forms are the same code ("reyhan10" === "REYHAN10").
 */
export function normalizeDiscountCodeForKey(rawCode: unknown): string {
  return normalizeDiscountCode(rawCode).toUpperCase();
}

/** A submitted discount code after normalization. */
export type SubmittedDiscountCode = {
  /** Whether any code at all was submitted. */
  present: boolean;
  /** Display form of the code (trimmed, length-capped). */
  code: string;
};

/**
 * Resolve the codes submitted with a checkout from arbitrary client data.
 *
 * Rules (server-enforced, never bypassable from the client):
 *   - more than one code → rejected with the stacking error
 *   - exactly one code   → normalized and returned
 *   - none               → an absent discount
 *
 * The result carries either a normalized code or a Persian rejection the
 * caller surfaces to the UI; no amount or eligibility decision happens here.
 */
export function resolveSubmittedDiscountCode(
  codes: unknown[]
): { ok: true; code: SubmittedDiscountCode } | { ok: false; error: string } {
  const present = codes
    .map((c) => normalizeDiscountCode(c))
    .filter((c) => c.length > 0);

  if (present.length > 1) {
    return { ok: false, error: DISCOUNT_STACK_MESSAGE };
  }
  if (present.length === 1) {
    return { ok: true, code: { present: true, code: present[0] } };
  }
  return { ok: true, code: { present: false, code: "" } };
}
