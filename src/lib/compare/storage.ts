// Comparison store — localStorage layer for product comparison.
// Tracks product slugs the user has added to the comparison list.

export const COMPARE_STORAGE_KEY = "reyhan-compare";
const MAX_COMPARE = 4;

function isCompareEntry(value: unknown): value is { slug: string; addedAt: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    v.slug.length > 0 &&
    v.slug.length <= 256 &&
    typeof v.addedAt === "number" &&
    Number.isFinite(v.addedAt) &&
    v.addedAt > 0
  );
}

function sanitizeEntries(value: unknown): { slug: string; addedAt: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { slug: string; addedAt: number }[] = [];
  for (const raw of value.slice(0, MAX_COMPARE)) {
    if (!isCompareEntry(raw)) continue;
    out.push({ slug: raw.slug, addedAt: raw.addedAt });
  }
  return out;
}

export function readCompareSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeEntries(JSON.parse(raw)).map((e) => e.slug);
  } catch {
    return [];
  }
}

export function addCompareSlug(slug: string): { ok: true; slugs: string[] } | { ok: false; error: string; slugs: string[] } {
  if (typeof window === "undefined") {
    return { ok: false, error: "ذخیره‌سازی در مرورگر فعال نیست.", slugs: [] };
  }
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    const entries = sanitizeEntries(raw ? JSON.parse(raw) : []);
    if (entries.some((e) => e.slug === slug)) {
      const slugs = entries.map((e) => e.slug);
      return { ok: true, slugs };
    }
    if (entries.length >= MAX_COMPARE) {
      return {
        ok: false,
        error: `امکان مقایسه بیش از ${MAX_COMPARE} محصول وجود ندارد.`,
        slugs: entries.map((e) => e.slug),
      };
    }
    const now = Date.now();
    const updated = [{ slug, addedAt: now }, ...entries].slice(0, MAX_COMPARE);
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
    return { ok: true, slugs: updated.map((e) => e.slug) };
  } catch {
    return { ok: false, error: "خطا در ذخیره‌سازی.", slugs: [] };
  }
}

export function removeCompareSlug(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    const entries = sanitizeEntries(raw ? JSON.parse(raw) : []);
    const updated = entries.filter((e) => e.slug !== slug);
    if (updated.length === 0) {
      window.localStorage.removeItem(COMPARE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated.map((e) => e.slug);
  } catch {
    return [];
  }
}

export function clearCompare(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(COMPARE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isInCompare(slug: string): boolean {
  return readCompareSlugs().includes(slug);
}