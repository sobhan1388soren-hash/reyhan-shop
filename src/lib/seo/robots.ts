// Robots rules — Phase 17 SEO foundation.
//
// Pure, DB-free allow/deny vocabulary for crawl guidance. This defines which
// route prefixes are disallowed in robots.txt. robots.txt is crawl guidance,
// NOT an indexing directive — the authoritative per-page index control is the
// `noindex` metadata emitted by buildPrivateMetadata / layout metadata. Both
// layers are kept in sync by sharing this vocabulary.

export type RobotRule = {
  /** Path pattern relative to the site root (robots.txt syntax). */
  pattern: string;
  /** Human-readable reason (used by tests + diagnostics, never rendered). */
  reason: string;
};

/**
 * Private/internal route prefixes excluded from crawling. Public storefront
 * content (products, categories, blog, homepage) is intentionally NOT here.
 */
export const DISALLOWED_ROUTES: readonly RobotRule[] = [
  { pattern: "/admin", reason: "Admin console — authenticated, non-public" },
  { pattern: "/admin/", reason: "Admin console (nested) — authenticated, non-public" },
  { pattern: "/account", reason: "Customer account — authenticated, private" },
  { pattern: "/account/", reason: "Customer account (nested) — authenticated, private" },
  { pattern: "/checkout", reason: "Transactional checkout flow" },
  { pattern: "/cart", reason: "Shopping cart — session state, not content" },
  { pattern: "/payment", reason: "Payment gateway result pages" },
  { pattern: "/login", reason: "Authentication route" },
  { pattern: "/register", reason: "Authentication route" },
  { pattern: "/api", reason: "API routes — machine endpoints, not documents" },
];

/**
 * Public landing pages explicitly allowed (documented for tests; robots.txt
 * uses an `Allow: /` default plus the disallow list above).
 */
export const PUBLIC_INDEXABLE_PREFIXES: readonly string[] = [
  "/",
  "/products",
  "/categories",
  "/blog",
];

/** True when a pathname starts with any disallowed prefix. */
export function isDisallowedPath(pathname: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return DISALLOWED_ROUTES.some((rule) => {
    // A disallow pattern without a trailing slash also covers its subtree;
    // "/admin" matches "/admin" and "/admin/...".
    if (rule.pattern.endsWith("/")) return normalized.startsWith(rule.pattern);
    return normalized === rule.pattern || normalized.startsWith(`${rule.pattern}/`);
  });
}

/**
 * Public non-indexable utility pages under otherwise-public prefixes. These
 * are real routes that exist but should not be indexed (search/filter/pagination
 * combinations canonicalize to their landing page).
 */
export const NOINDEX_PUBLIC_PATHS: readonly string[] = ["/payment/result", "/cart"];

/** True when a public path should carry `noindex` (e.g. filtered/search URLs). */
export function isPublicNoIndexPath(pathname: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return NOINDEX_PUBLIC_PATHS.some((pattern) =>
    normalized === pattern || normalized.startsWith(`${pattern}/`)
  );
}
