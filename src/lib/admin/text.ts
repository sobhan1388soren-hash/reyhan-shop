// Shared pure text/number primitives for the admin domain — DB-free and
// framework-free so every admin rules module (categories, products, and
// later modules) can be unit-tested in a bare `node --test` process.
//
// These helpers existed inline in category-rules.ts (Phase 14-B); Phase
// 14 product rules reuse them instead of creating a duplicate validation
// framework. category-rules re-exports the same functions so existing
// callers/tests keep working unchanged.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Persian/Arabic-Indic digits embedded in a string to Latin. */
export function toLatinDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const fi = FA_DIGITS.indexOf(ch);
    if (fi >= 0) {
      out += String(fi);
      continue;
    }
    const ai = AR_DIGITS.indexOf(ch);
    if (ai >= 0) {
      out += String(ai);
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Parse an integer that may use Persian/Arabic digits. Strict on shape,
 * capped at 9 digits (enough for sortOrder/thresholds/quantities).
 */
export function parseStrictInt(raw: string): number | null {
  const trimmed = toLatinDigits(raw.trim());
  if (!/^[+-]?\d{1,9}$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

/**
 * Parse a signed integer with a configurable digit cap — money values in
 * Rial can legitimately exceed the 9-digit cap of parseStrictInt.
 */
export function parseStrictIntWithDigits(raw: string, maxDigits: number): number | null {
  const trimmed = toLatinDigits(raw.trim());
  const pattern = new RegExp(`^[+-]?\\d{1,${maxDigits}}$`);
  if (!pattern.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

/** Collapse inner whitespace and trim. */
export function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a slug the same way the catalog slugifier does: trim, lowercase
 * (Latin), strip characters outside word/Persian/hyphen/space, spaces →
 * hyphens, collapsed hyphens. Persian text survives normalization.
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * URL policy for admin-entered media: an absolute http(s) URL or a
 * root-relative path. Protocol-relative (`//host`) and other schemes are
 * rejected. Used by category images and product media.
 */
export function isValidMediaUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}

// ── Money (Toman input → Rial storage) ─────────────────────────────────
// Money is entered by admins in Toman (the display currency) and stored in
// Rial (schema Int). The cap keeps stored Rial below the Postgres 32-bit
// INTEGER ceiling. Shared by product pricing and the discount admin.

export function parseMoneyTomanToRial(raw: string, maxToman: number): number | null {
  const trimmed = toLatinDigits(raw.trim());
  if (!trimmed) return null;
  const toman = parseStrictIntWithDigits(trimmed, 9);
  if (toman === null || toman < 0 || toman > maxToman) return null;
  return toman * 10;
}

export function parseOptionalMoneyTomanToRial(
  raw: string,
  maxToman: number
): number | null | undefined {
  const trimmed = toLatinDigits(raw.trim());
  if (!trimmed) return null;
  const parsed = parseMoneyTomanToRial(trimmed, maxToman);
  return parsed === null ? undefined : parsed;
}

/**
 * Parse a date-only or ISO date string from an admin form. Empty → null;
 * invalid → undefined. Date-only strings are anchored to UTC midnight so
 * validation is deterministic across environments.
 */
export function parseDateInput(raw: string): Date | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}