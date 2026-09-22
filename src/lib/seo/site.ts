// Centralized site origin + URL construction — Phase 17 SEO foundation.
//
// The single source of truth for the public site origin is
// NEXT_PUBLIC_SITE_URL (surfaced as SITE_URL in lib/constants). The final
// production domain is NOT decided, so nothing here hardcodes a host: every
// absolute URL is derived from that env value, with the existing project
// development fallback (http://localhost:3000) when it is absent.
//
// Pure, framework-free and DB-free so it is unit-testable in a bare
// `node --test` process. The only runtime concern is reading the env value,
// which is read lazily so tests can override process.env.NEXT_PUBLIC_SITE_URL.
//
// URL shape policy:
//   - origin never carries a trailing slash
//   - paths always start with a single "/"
//   - absolute URLs never contain duplicated slashes (except the scheme "://")
//   - canonical URLs carry no query/fragment and no trailing slash (except "/")
//   - media URLs may be absolute (http/https) or root-relative; both resolve
//     safely to an absolute URL for OG/sitemap/JSON-LD use.

const DEFAULT_ORIGIN = "http://localhost:3000";

/**
 * Resolve the public site origin from NEXT_PUBLIC_SITE_URL. Trims any
 * trailing slash(es) and whitespace. When the env value is missing or
 * malformed, falls back to the existing development origin (never an
 * invented production domain).
 */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return DEFAULT_ORIGIN;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_ORIGIN;
  const origin = trimmed.replace(/\/+$/, "");
  // Minimal validity guard: must look like an http(s) origin.
  if (!/^https?:\/\/[^/]+$/i.test(origin)) return DEFAULT_ORIGIN;
  return origin;
}

/** True when running without a configured production origin (development). */
export function isDevelopmentOrigin(): boolean {
  return siteOrigin().startsWith("http://localhost");
}

/**
 * Normalize a path: ensure a single leading slash, collapse repeated slashes,
 * strip query/fragment, and drop a trailing slash (except for the root).
 * Pass `preserveQuery: true` to keep the search string intact.
 */
export function normalizePath(path: string, options?: { preserveQuery?: boolean }): string {
  if (!path) return "/";
  let working = path.trim();
  if (!working.startsWith("/")) working = `/${working}`;
  if (!options?.preserveQuery) {
    const qIndex = working.search(/[?#]/);
    if (qIndex >= 0) working = working.slice(0, qIndex);
  }
  // Collapse any run of slashes beyond the leading one.
  working = working.replace(/\/{2,}/g, "/");
  // Remove trailing slash unless this is the root path.
  if (working.length > 1 && working.endsWith("/")) working = working.replace(/\/+$/, "");
  return working || "/";
}

/** Build a deterministic absolute canonical URL for a public path. */
export function canonicalUrl(path: string): string {
  return `${siteOrigin()}${normalizePath(path)}`;
}

/**
 * Resolve a stored media/link value (product image, category image, post
 * cover) to an absolute URL. Absolute http(s) URLs pass through untouched;
 * root-relative paths are joined to the origin. Empty/protocol-relative/
 * other-scheme values return null so callers omit the image rather than emit
 * a malformed URL.
 */
export function absoluteMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${siteOrigin()}${normalizePath(trimmed)}`;
  return null;
}

/** Absolute sitemap.xml URL (referenced from robots.txt). */
export function sitemapUrl(): string {
  return canonicalUrl("/sitemap.xml");
}

/** Absolute robots.txt URL. */
export function robotsUrl(): string {
  return canonicalUrl("/robots.txt");
}
