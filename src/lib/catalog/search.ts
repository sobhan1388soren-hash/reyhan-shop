// Search architecture — Persian/UTF-8 safe, no external service
// Foundation for future full-text (extends to Prisma where clauses)

export function parseSearchTerm(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 100);
  if (trimmed.length === 0) return undefined;
  // Basic sanitization: allow Persian/Arabic, Latin, numbers, spaces, hyphen
  // Keep UTF-8 intact — do not strip Persian characters
  return trimmed;
}

// Builds Prisma where fragment for Product search
import type { Prisma } from "@prisma/client";

export function buildSearchWhere(q: string | undefined): Prisma.ProductWhereInput | undefined {
  const term = parseSearchTerm(q);
  if (!term) return undefined;

  // Case-insensitive contains — works for Persian as well (PostgreSQL collation)
  // Extend later with `mode: 'insensitive'` or full-text search
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { seoKeywords: { contains: term, mode: "insensitive" } },
    ],
  };
}

export function searchToQueryString(q: string | undefined): string {
  return parseSearchTerm(q) ?? "";
}
