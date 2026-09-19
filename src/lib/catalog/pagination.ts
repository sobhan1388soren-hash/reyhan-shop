import type { PaginationMeta } from "./types";

export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export const MAX_PAGE_SIZE = 48;

export function parsePagination(params: {
  page?: string | number;
  pageSize?: string | number;
}): { page: number; pageSize: number; skip: number; take: number } {
  let page = typeof params.page === "string" ? parseInt(params.page, 10) : (params.page ?? 1);
  let pageSize = typeof params.pageSize === "string" ? parseInt(params.pageSize, 10) : (params.pageSize ?? DEFAULT_PAGE_SIZE);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

export function buildPageUrl(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | number | undefined | null>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, String(value));
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
