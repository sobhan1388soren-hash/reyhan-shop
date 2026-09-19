import type { CatalogSearchParams } from "./types";
import { parseSearchTerm } from "./search";

// Extensible filtering — supports variant price + specification key/values + availability
// Parses URLSearchParams → typed filters; builds Prisma where fragments

export type UrlSearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function getParam(params: UrlSearchParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function getParamsArray(params: UrlSearchParamsLike, key: string): string[] {
  if (params instanceof URLSearchParams) {
    return params.getAll(key).filter(Boolean);
  }
  const v = params[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseCatalogSearchParams(
  params: UrlSearchParamsLike,
  options?: { categoryPath?: string[] }
): CatalogSearchParams {
  const q = parseSearchTerm(getParam(params, "q") ?? getParam(params, "search"));
  const category = getParam(params, "category");
  const page = parseInt(getParam(params, "page") ?? "1", 10);
  const pageSize = parseInt(getParam(params, "pageSize") ?? getParam(params, "limit") ?? "12", 10);
  const sort = getParam(params, "sort") as CatalogSearchParams["sort"];
  const minPrice = getParam(params, "minPrice") ?? getParam(params, "min_price");
  const maxPrice = getParam(params, "maxPrice") ?? getParam(params, "max_price");
  const inStock = getParam(params, "inStock") ?? getParam(params, "in_stock");

  // specs: spec_{key}=value1&spec_{key}=value2  or  specs[key]=value
  // Also support generic `spec=key:value`
  const specs: Record<string, string[]> = {};
  const entries: [string, string][] =
    params instanceof URLSearchParams
      ? Array.from(params.entries())
      : Object.entries(params).flatMap(([k, v]) => {
          if (Array.isArray(v)) return v.map((val) => [k, val] as [string, string]);
          if (v == null) return [];
          return [[k, v as string] as [string, string]];
        });

  for (const [rawKey, rawValue] of entries) {
    if (!rawValue) continue;
    if (rawKey.startsWith("spec_")) {
      const key = rawKey.slice(5);
      if (!key) continue;
      specs[key] = specs[key] ?? [];
      specs[key].push(rawValue);
    } else if (rawKey.startsWith("specs[")) {
      const match = rawKey.match(/^specs\[(.+)\]$/);
      if (match) {
        const key = match[1];
        specs[key] = specs[key] ?? [];
        specs[key].push(rawValue);
      }
    } else if (rawKey === "spec") {
      // spec=key:value
      const idx = rawValue.indexOf(":");
      if (idx > 0) {
        const k = rawValue.slice(0, idx);
        const val = rawValue.slice(idx + 1);
        specs[k] = specs[k] ?? [];
        specs[k].push(val);
      }
    }
  }

  // Availability can be repeated: availability=in_stock&availability=low_stock
  const availabilityRaw = getParamsArray(params, "availability");
  const availability = availabilityRaw.filter((v) =>
    ["in_stock", "low_stock", "out_of_stock", "unavailable"].includes(v)
  ) as CatalogSearchParams["availability"];

  return {
    q,
    category: category || undefined,
    categoryPath: options?.categoryPath,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 48) : 12,
    sort: sort as CatalogSearchParams["sort"],
    minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
    maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
    specs: Object.keys(specs).length ? specs : undefined,
    availability,
    inStock: inStock === "1" || inStock === "true" ? true : undefined,
  };
}

// Build Prisma where fragments for filtering
import type { Prisma } from "@prisma/client";

export function buildFilterWhere(params: CatalogSearchParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  // Price range — filters via variants price (at least one variant in range)
  if (params.minPrice != null || params.maxPrice != null) {
    const priceFilter: Prisma.IntFilter = {};
    if (params.minPrice != null && Number.isFinite(params.minPrice)) priceFilter.gte = params.minPrice;
    if (params.maxPrice != null && Number.isFinite(params.maxPrice)) priceFilter.lte = params.maxPrice;

    where.variants = {
      some: {
        isActive: true,
        price: priceFilter,
      },
    };
  }

  // Availability quick filter
  if (params.inStock) {
    where.variants = {
      some: {
        isActive: true,
        inventory: {
          quantity: { gt: 0 },
        },
      },
    };
  }

  // Specification filters — each key/value pair requires a matching ProductSpecification
  if (params.specs) {
    const andConditions: Prisma.ProductWhereInput[] = [];
    for (const [key, values] of Object.entries(params.specs)) {
      if (!values.length) continue;
      andConditions.push({
        specifications: {
          some: {
            key,
            value: { in: values },
          },
        },
      });
    }
    if (andConditions.length) {
      where.AND = andConditions;
    }
  }

  return where;
}

// For resetting filters — produce clean URL without spec/price/availability
export function catalogParamsToUrlSearch(
  params: CatalogSearchParams
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (params.q) out.q = params.q;
  if (params.category) out.category = params.category;
  if (params.page && params.page !== 1) out.page = String(params.page);
  if (params.pageSize && params.pageSize !== 12) out.pageSize = String(params.pageSize);
  if (params.sort) out.sort = params.sort;
  if (params.minPrice != null) out.minPrice = String(params.minPrice);
  if (params.maxPrice != null) out.maxPrice = String(params.maxPrice);
  if (params.availability?.length) out.availability = params.availability;
  if (params.specs) {
    for (const [k, vals] of Object.entries(params.specs)) {
      out[`spec_${k}`] = vals;
    }
  }
  if (params.inStock) out.inStock = "1";
  return out;
}
