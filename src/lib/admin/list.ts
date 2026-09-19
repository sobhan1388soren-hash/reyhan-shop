// Shared admin list foundation — pure, DB-free, framework-free input
// handling for every admin management list (Phase 14-A onward: orders,
// customers, and the later product/category/discount modules).
//
// Security model:
//   - client search/filter/sort values are NEVER forwarded raw to Prisma;
//     enum filters are whitelist-checked here and unknown values are
//     dropped (never an error, never an injection path)
//   - pagination reuses the existing pure catalog pagination helpers
//   - the admin pages stay server components: no client state, every
//     list interaction is a plain GET query param (bookmarkable/back-safe)

import { parsePagination } from "../catalog/pagination.ts";

export const ADMIN_PAGE_SIZE = 20;
export const ADMIN_SEARCH_MAX_LENGTH = 64;

export type AdminListSearchParams = Record<string, string | string[] | undefined>;

/** First value of a possibly-repeated query param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Normalize a search term: trim, collapse whitespace, hard length cap. */
export function parseAdminSearchTerm(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return undefined;
  return collapsed.slice(0, ADMIN_SEARCH_MAX_LENGTH);
}

/** Whitelist an enum-ish filter; unknown/forged values → undefined. */
export function parseEnumFilter<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (value == null) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Whitelist a sort option with a fixed fallback. */
export function parseSortOption<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T
): T {
  return parseEnumFilter(value, options) ?? fallback;
}

/** Page parsing for admin lists — fixed page size, clamped page number. */
export function parseAdminListPage(
  searchParams: AdminListSearchParams
): { page: number; pageSize: number; skip: number; take: number } {
  return parsePagination({
    page: firstParam(searchParams.page),
    pageSize: ADMIN_PAGE_SIZE,
  });
}
