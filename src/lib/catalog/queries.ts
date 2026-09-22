import prisma from "@/lib/prisma";
import type { Prisma, OrderStatus } from "@prisma/client";
import type {
  CatalogProduct,
  CatalogCategory,
  PaginatedResult,
  CatalogSearchParams,
} from "./types";
import { parsePagination, buildPaginationMeta } from "./pagination";
import { parseSort, sortToPrismaOrderBy } from "./sorting";
import { buildSearchWhere } from "./search";
import { buildFilterWhere } from "./filtering";
import { getProductAvailability } from "./availability";
import { selectRankedProducts } from "@/lib/marketing/ranking";

// Safe wrapper — if DB is empty or unreachable, return empty result instead of crashing build
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    categories: { include: { category: { select: { id: true; name: true; slug: true } } } };
    variants: { include: { inventory: true } };
    specifications: true;
    images: true;
  };
}>;

const productInclude = {
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  variants: { include: { inventory: true } },
  specifications: true,
  images: { orderBy: { sortOrder: "asc" } as const },
} satisfies Prisma.ProductInclude;

// ── Category hierarchy — unlimited nesting ─────────────────────────────

function toCatalogCategory(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  status: string;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}): CatalogCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    parentId: c.parentId,
    level: c.level,
    status: c.status,
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
  };
}

export async function getCategoryTree(): Promise<CatalogCategory[]> {
  return safe(async () => {
    const categories = await prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const map = new Map<string, CatalogCategory & { children: CatalogCategory[] }>();
    for (const c of categories) {
      map.set(c.id, { ...toCatalogCategory(c), children: [] });
    }
    const roots: CatalogCategory[] = [];
    for (const cat of map.values()) {
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(cat);
      } else {
        roots.push(cat);
      }
    }
    return roots;
  }, []);
}

export async function getCategoryBySlug(slug: string): Promise<CatalogCategory | null> {
  return safe(async () => {
    const found = await prisma.category.findUnique({ where: { slug } });
    if (!found) return null;
    return toCatalogCategory(found);
  }, null);
}

export async function getCategoryByPath(path: string[]): Promise<CatalogCategory | null> {
  if (!path.length) return null;
  return safe(async () => {
    let current: CatalogCategory | null = null;
    for (const slug of path) {
      if (!current) {
        const found = await prisma.category.findUnique({ where: { slug } });
        if (!found || found.parentId) return null; // first must be root
        current = toCatalogCategory(found);
      } else {
        const parentId: string = current.id;
        const found = await prisma.category.findFirst({
          where: { slug, parentId },
        });
        if (!found) return null;
        current = toCatalogCategory(found);
      }
    }
    return current;
  }, null);
}

export async function getCategoryAncestors(categoryId: string): Promise<CatalogCategory[]> {
  return safe(async () => {
    const ancestors: CatalogCategory[] = [];
    let currentId: string | null = categoryId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      const lookupId: string = currentId;
      visited.add(lookupId);
      const found = await prisma.category.findUnique({ where: { id: lookupId } });
      if (!found) break;
      ancestors.unshift(toCatalogCategory(found));
      currentId = found.parentId;
    }
    // Includes chain including self — caller slices if needed
    return ancestors;
  }, []);
}

export async function getCategoryDescendantIds(categoryId: string): Promise<string[]> {
  return safe(async () => {
    const ids: string[] = [categoryId];
    const queue: string[] = [categoryId];
    const visited = new Set<string>([categoryId]);
    while (queue.length) {
      const parentId = queue.shift()!;
      const children = await prisma.category.findMany({
        where: { parentId },
        select: { id: true },
      });
      for (const ch of children) {
        if (!visited.has(ch.id)) {
          visited.add(ch.id);
          ids.push(ch.id);
          queue.push(ch.id);
        }
      }
    }
    return ids;
  }, [categoryId]);
}

export async function getCategoryChildren(parentId: string | null): Promise<CatalogCategory[]> {
  return safe(async () => {
    const cats = await prisma.category.findMany({
      where: { parentId, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return cats.map(toCatalogCategory);
  }, []);
}

// ── Product queries ────────────────────────────────────────────────────

function toCatalogProduct(raw: ProductWithRelations): CatalogProduct {
  const variants = raw.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    isActive: v.isActive,
    isDefault: v.isDefault,
    inventory: v.inventory
      ? {
          quantity: v.inventory.quantity,
          reservedQuantity: v.inventory.reservedQuantity,
          lowStockThreshold: v.inventory.lowStockThreshold,
        }
      : null,
  }));

  const prices = variants.filter((v) => v.isActive).map((v) => v.price);
  const priceRange = {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
  };

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    shortDescription: raw.shortDescription,
    status: raw.status,
    isFeatured: raw.isFeatured,
    seoTitle: raw.seoTitle,
    seoDescription: raw.seoDescription,
    categories: raw.categories.map((c) => c.category),
    variants,
    specifications: raw.specifications,
    images: raw.images,
    availability: getProductAvailability(raw.status, variants),
    priceRange,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function getProductsPaginated(
  params: CatalogSearchParams
): Promise<PaginatedResult<CatalogProduct>> {
  return safe(async () => {
    const { page, pageSize, skip, take } = parsePagination({
      page: params.page,
      pageSize: params.pageSize,
    });
    const sort = parseSort(params.sort);

    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
    };

    // Search
    const searchWhere = buildSearchWhere(params.q);
    if (searchWhere) Object.assign(where, searchWhere);

    // Filter extensible
    const filterWhere = buildFilterWhere(params);
    Object.assign(where, filterWhere);

    // Category filter — supports single slug or full path descendant inclusion
    if (params.categoryPath?.length) {
      const cat = await getCategoryByPath(params.categoryPath);
      if (cat) {
        const ids = await getCategoryDescendantIds(cat.id);
        where.categories = {
          some: { categoryId: { in: ids } },
        };
      } else {
        // Path not found → no results
        return { data: [], meta: buildPaginationMeta(0, page, pageSize) };
      }
    } else if (params.category) {
      const cat = await getCategoryBySlug(params.category);
      if (cat) {
        const ids = await getCategoryDescendantIds(cat.id);
        where.categories = {
          some: { categoryId: { in: ids } },
        };
      } else {
        return { data: [], meta: buildPaginationMeta(0, page, pageSize) };
      }
    }

    const orderBy = sortToPrismaOrderBy(sort);

    // Price sorting needs manual post-sort because price lives in variants
    const isPriceSort = sort === "price_asc" || sort === "price_desc";

    if (isPriceSort) {
      // Fetch all matching, then sort by min variant price (pagination after sort)
      // For performance, limit to reasonable set; in production use DB aggregation
      const all = await prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: "desc" },
      });
      const mapped = all.map(toCatalogProduct);
      mapped.sort((a, b) => {
        const aPrice = a.priceRange.min ?? Number.MAX_SAFE_INTEGER;
        const bPrice = b.priceRange.min ?? Number.MAX_SAFE_INTEGER;
        return sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
      });

      let filtered = mapped;
      if (params.availability?.length) {
        filtered = filtered.filter((p) => params.availability!.includes(p.availability));
      }

      const total = filtered.length;
      const paged = filtered.slice(skip, skip + take);
      return { data: paged, meta: buildPaginationMeta(total, page, pageSize) };
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    let data = items.map(toCatalogProduct);

    if (params.availability?.length) {
      // Need to adjust total as well — filter data then recompute meta
      // For accurate pagination we would need DB-level availability, but we do post-filter fallback
      const allForCount = await prisma.product.findMany({
        where,
        include: productInclude,
      });
      const allMapped = allForCount.map(toCatalogProduct);
      const filteredAll = allMapped.filter((p) => params.availability!.includes(p.availability));
      const filteredTotal = filteredAll.length;
      data = filteredAll
        .sort((a, b) => {
          // keep sort order consistent
          if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
          if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
          if (sort === "title_asc") return a.title.localeCompare(b.title);
          if (sort === "title_desc") return b.title.localeCompare(a.title);
          return 0;
        })
        .slice(skip, skip + take);
      return { data, meta: buildPaginationMeta(filteredTotal, page, pageSize) };
    }

    return { data, meta: buildPaginationMeta(total, page, pageSize) };
  }, {
    data: [],
    meta: buildPaginationMeta(0, 1, 12),
  });
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  return safe(async () => {
    const p = await prisma.product.findUnique({
      where: { slug },
      include: {
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        variants: { include: { inventory: true } },
        specifications: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!p) return null;
    return toCatalogProduct(p);
  }, null);
}

export async function getRelatedProducts(productId: string, categoryIds: string[], take = 4): Promise<CatalogProduct[]> {
  return safe(async () => {
    if (!categoryIds.length) return [];
    const items = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: "ACTIVE",
        categories: { some: { categoryId: { in: categoryIds } } },
      },
      include: productInclude,
      take,
      orderBy: { createdAt: "desc" },
    });
    return items.map(toCatalogProduct);
  }, []);
}

// ── Homepage selections (Phase 16) ─────────────────────────────────────
// Both reuse the shared productInclude/toCatalogProduct mapping so a
// homepage card behaves exactly like a catalog card (same price range,
// availability and URL structure). No parallel product-selection system.

/**
 * Manually curated "featured" products — the admin `isFeatured` flag is the
 * single source of truth (set on the product form). Only ACTIVE products
 * are storefront-visible; the flag alone never surfaces a draft/archived
 * product.
 */
export async function getFeaturedProducts(take = 8): Promise<CatalogProduct[]> {
  return safe(async () => {
    const items = await prisma.product.findMany({
      where: { isFeatured: true, status: "ACTIVE" },
      include: productInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return items.map(toCatalogProduct);
  }, []);
}

/**
 * "Best-selling" ranking derived from REAL order data only. A valid sale is
 * a PAID order that was not cancelled or returned (the payment success
 * signal from the Phase 10 architecture). Ranks products by aggregated sold
 * quantity, then keeps only storefront-valid (ACTIVE) products and returns
 * them in rank order. Sales numbers are intentionally NOT returned — the
 * homepage shows products, never fabricated or exposed business metrics.
 * Empty/no-sales data → empty array (the section is omitted upstream).
 */
const VALID_SALE_ORDER_STATUS: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export async function getBestSellingProducts(take = 8): Promise<CatalogProduct[]> {
  return safe(async () => {
    const ranked = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: { paymentStatus: "PAID", status: { in: VALID_SALE_ORDER_STATUS } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take,
    });
    if (ranked.length === 0) return [];

    const ids = ranked.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      include: productInclude,
    });

    // Preserve the sales ranking; drop ids whose product is no longer
    // storefront-valid (draft/archived/deleted).
    return selectRankedProducts(ranked, products.map(toCatalogProduct), take);
  }, []);
}

// For dynamic filter UI: distinct spec keys/values from current result set (extensible)
export async function getAvailableSpecFilters(
  params: Omit<CatalogSearchParams, "specs" | "page" | "pageSize">
): Promise<{ key: string; label: string; values: { value: string; label: string }[] }[]> {
  return safe(async () => {
    const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
    const searchWhere = buildSearchWhere(params.q);
    if (searchWhere) Object.assign(where, searchWhere);
    if (params.category) {
      const cat = await getCategoryBySlug(params.category);
      if (cat) {
        const ids = await getCategoryDescendantIds(cat.id);
        where.categories = { some: { categoryId: { in: ids } } };
      }
    }
    const specs = await prisma.productSpecification.findMany({
      where: {
        product: where,
      },
      distinct: ["key", "value"],
      select: { key: true, value: true },
      orderBy: [{ key: "asc" }, { value: "asc" }],
      take: 500,
    });
    const map = new Map<string, Set<string>>();
    for (const s of specs) {
      if (!map.has(s.key)) map.set(s.key, new Set());
      map.get(s.key)!.add(s.value);
    }
    return Array.from(map.entries()).map(([key, set]) => ({
      key,
      label: key,
      values: Array.from(set).map((v) => ({ value: v, label: v })),
    }));
  }, []);
}
