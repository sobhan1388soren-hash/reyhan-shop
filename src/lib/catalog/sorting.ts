import type { CatalogSortOption } from "./types";

export type { CatalogSortOption };

export const SORT_OPTIONS: { value: CatalogSortOption; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "title_asc", label: "نام: الف تا ی" },
  { value: "title_desc", label: "نام: ی تا الف" },
];

export function parseSort(value: string | undefined): CatalogSortOption {
  const allowed: CatalogSortOption[] = ["newest", "oldest", "price_asc", "price_desc", "title_asc", "title_desc"];
  if (value && allowed.includes(value as CatalogSortOption)) return value as CatalogSortOption;
  return "newest";
}

// Prisma orderBy — used in queries.ts; price sorting requires variant price, handled via aggregation
import type { Prisma } from "@prisma/client";

export function sortToPrismaOrderBy(sort: CatalogSortOption): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "newest":
      return { createdAt: "desc" };
    case "oldest":
      return { createdAt: "asc" };
    case "title_asc":
      return { title: "asc" };
    case "title_desc":
      return { title: "desc" };
    // For price sorts, caller should handle via variants min price — fallback to createdAt
    case "price_asc":
    case "price_desc":
      return { createdAt: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export function sortLabel(value: CatalogSortOption): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "جدیدترین";
}
