// Formatting — Persian e-commerce aware, RTL-safe

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert Latin digits in a string to Persian digits (۰-۹). */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Format a price stored in Rial for display in Toman with Persian digits.
 * Schema stores prices in Rial (1 Toman = 10 Rial).
 */
export function formatPriceToman(priceRial: number | null | undefined): string {
  if (priceRial == null) return "—";
  const toman = Math.round(priceRial / 10);
  return `${toFaDigits(new Intl.NumberFormat("en-US").format(toman))} تومان`;
}

/** Format a Rial price as Rial with Persian digits (rarely needed). */
export function formatPriceRial(priceRial: number | null | undefined): string {
  if (priceRial == null) return "—";
  return `${toFaDigits(new Intl.NumberFormat("en-US").format(priceRial))} ریال`;
}

/** Backward-compatible alias — display currency is Toman. */
export const formatPrice = formatPriceToman;

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) {
    return `${formatPriceToman(min)} تا ${formatPriceToman(max)}`;
  }
  return formatPriceToman(min ?? max);
}

/** Format a Date as a Persian (Solar Hijri) date, e.g. «۱۵ خرداد ۱۴۰۳». */
export function formatFaDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(date);
}

/** Format a plain integer (stock count, counts…) with Persian digits. */
export function formatNumber(value: number): string {
  return toFaDigits(new Intl.NumberFormat("en-US").format(value));
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}
