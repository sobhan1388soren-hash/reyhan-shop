// Recently Viewed Products — localStorage persistence layer.
// Tracks product slugs the user has viewed, most-recent first.
// Malformed or hostile data is dropped silently; the store never crashes.

export const RECENTLY_VIEWED_KEY = "reyhan-recent";
const MAX_RECENT = 20;

function isRecentEntry(value: unknown): value is { slug: string; viewedAt: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    v.slug.length > 0 &&
    v.slug.length <= 256 &&
    typeof v.viewedAt === "number" &&
    Number.isFinite(v.viewedAt) &&
    v.viewedAt > 0 &&
    v.viewedAt <= Date.now() + 60_000
  );
}

function sanitizeEntries(value: unknown): { slug: string; viewedAt: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { slug: string; viewedAt: number }[] = [];
  const seen = new Set<string>();
  for (const raw of value.slice(0, MAX_RECENT)) {
    if (!isRecentEntry(raw)) continue;
    if (seen.has(raw.slug)) continue;
    seen.add(raw.slug);
    out.push({ slug: raw.slug, viewedAt: raw.viewedAt });
  }
  return out;
}

export function readRecentSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    return sanitizeEntries(JSON.parse(raw)).map((e) => e.slug);
  } catch {
    return [];
  }
}

export function addRecentSlug(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const entries = sanitizeEntries(raw ? JSON.parse(raw) : []);
    const now = Date.now();
    const filtered = entries.filter((e) => e.slug !== slug);
    const updated = [{ slug, viewedAt: now }, ...filtered].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function clearRecentSlugs(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(RECENTLY_VIEWED_KEY);
    return true;
  } catch {
    return false;
  }
}