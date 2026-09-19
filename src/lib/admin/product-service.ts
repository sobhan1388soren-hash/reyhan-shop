// Product management service — server-only Prisma adapter for the pure
// product rules (./product-rules). Phase 14, Part 1.
//
// Security model (mirrors category-service/reviews/discounts):
//   - every mutation receives an actor resolved SERVER-SIDE by the action
//     layer (requireAdminForAction → the DB user row); the role is
//     re-checked here with the existing ADMIN/STAFF allow-list — client
//     input never carries authorization facts
//   - costPrice is internal (ADMIN-only): reads mask it for STAFF and
//     writes ignore it unless the actor is ADMIN
//   - raw form values never reach Prisma directly: the pure rules
//     normalize/whitelist them first; foreign category/variant ids are
//     re-validated against real rows in the same transaction as the write
//   - pricing history is written ONLY when a price value actually changes;
//     inventory changes replay the checkout guarded-write pattern so stock
//     can never fall below reserved orders, and every change is audited
//   - deletion is conservative (order history / live carts / DB Restrict)
//     with admin-friendly Persian messaging and a deactivate/archive path
//   - DB failures map to stable machine codes — the admin never sees raw
//     database errors and no fake data is substituted

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, ProductStatus } from "@prisma/client";
import { isAdminCapableRole } from "./rules.ts";
import {
  validateProductInput,
  validateVariantInput,
  validateSpecificationInput,
  validateMediaInput,
  validateInventoryInput,
  normalizeSpecKey,
  hasDuplicateSpecKey,
  derivePricePoint,
  evaluateProductDeletion,
  evaluateVariantDeletion,
  applyInventoryChange,
  moveMediaToFront,
  nextMediaSortOrder,
  canAddMedia,
  canViewCostPrice,
  parseStrictInt,
} from "./product-rules.ts";
import type {
  ProductErrorCode,
  ProductInputRaw,
  VariantInputRaw,
  SpecificationInputRaw,
  MediaInputRaw,
  InventoryInputRaw,
  NormalizedProductInput,
} from "./product-rules.ts";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";
import { getProductAvailability } from "@/lib/catalog/availability";
import type { CatalogVariant } from "@/lib/catalog/types";

export type Actor = { id: string; role: string };

export type ProductMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ProductErrorCode; fieldErrors?: Record<string, string> };

function canManageProducts(actor: Actor): boolean {
  return isAdminCapableRole(actor.role);
}

function fail(code: ProductErrorCode, fieldErrors?: Record<string, string>): ProductMutationResult<never> {
  return { ok: false, error: code, fieldErrors };
}

// ── Reads: list ────────────────────────────────────────────────────────

export const ADMIN_PRODUCT_SORTS = [
  "updated_desc",
  "created_desc",
  "created_asc",
  "title_asc",
  "title_desc",
] as const;
export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

export type AdminProductListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: ProductStatus;
  categoryId?: string;
  featured?: boolean;
  sort: AdminProductSort;
};

export type AdminProductListResult =
  | { state: "ok"; rows: AdminProductRow[]; meta: PaginationMeta }
  | { state: "error" };

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  isFeatured: boolean;
  imageUrl: string | null;
  categories: { id: string; name: string }[];
  variantCount: number;
  activeVariantCount: number;
  priceFrom: number | null;
  priceTo: number | null;
  totalStock: number;
  availability: ReturnType<typeof getProductAvailability>;
  updatedAt: Date;
};

const PRODUCT_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  isFeatured: true,
  updatedAt: true,
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  categories: { select: { category: { select: { id: true, name: true } } } },
  variants: {
    select: {
      id: true,
      title: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      isActive: true,
      isDefault: true,
      inventory: {
        select: { quantity: true, reservedQuantity: true, lowStockThreshold: true },
      },
    },
  },
} satisfies Prisma.ProductSelect;

function productOrderBy(sort: AdminProductSort): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "created_desc":
      return { createdAt: "desc" };
    case "created_asc":
      return { createdAt: "asc" };
    case "title_asc":
      return { title: "asc" };
    case "title_desc":
      return { title: "desc" };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

export async function getAdminProducts(
  filters: AdminProductListFilters
): Promise<AdminProductListResult> {
  try {
    const where: Prisma.ProductWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.featured) where.isFeatured = true;
    if (filters.categoryId) where.categories = { some: { categoryId: filters.categoryId } };
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: "insensitive" } },
        { slug: { contains: filters.q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: filters.q, mode: "insensitive" } } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: productOrderBy(filters.sort),
        skip: filters.skip,
        take: filters.take,
        select: PRODUCT_LIST_SELECT,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map(toAdminProductRow),
    };
  } catch {
    return { state: "error" };
  }
}

function toAdminProductRow(raw: Prisma.ProductGetPayload<{ select: typeof PRODUCT_LIST_SELECT }>): AdminProductRow {
  const variants: CatalogVariant[] = raw.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    isActive: v.isActive,
    isDefault: v.isDefault,
    inventory: v.inventory,
  }));
  const activePrices = variants.filter((v) => v.isActive).map((v) => v.price);
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    status: raw.status,
    isFeatured: raw.isFeatured,
    imageUrl: raw.images[0]?.url ?? null,
    categories: raw.categories.map((c) => c.category),
    variantCount: variants.length,
    activeVariantCount: variants.filter((v) => v.isActive).length,
    priceFrom: activePrices.length ? Math.min(...activePrices) : null,
    priceTo: activePrices.length ? Math.max(...activePrices) : null,
    totalStock: variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0),
    availability: getProductAvailability(raw.status, variants),
    updatedAt: raw.updatedAt,
  };
}

// ── Reads: category options (for product forms/filters) ────────────────

export type AdminCategoryOption = {
  id: string;
  name: string;
  level: number;
  status: string;
  parentId: string | null;
};

export type AdminCategoryOptionsResult =
  | { state: "ok"; categories: AdminCategoryOption[] }
  | { state: "error" };

export async function getAdminCategoryOptions(): Promise<AdminCategoryOptionsResult> {
  try {
    const rows = await prisma.category.findMany({
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true, status: true, parentId: true },
    });
    return { state: "ok", categories: rows };
  } catch {
    return { state: "error" };
  }
}

// ── Reads: detail ──────────────────────────────────────────────────────

export type AdminVariantDetail = {
  id: string;
  title: string;
  sku: string;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  /** null for roles without cost access. */
  costPrice: number | null;
  weight: number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  inventory: {
    id: string;
    quantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
  } | null;
  orderItemCount: number;
  cartItemCount: number;
};

export type AdminPriceHistoryEntry = {
  id: string;
  variantId: string;
  variantTitle: string;
  price: number;
  compareAtPrice: number | null;
  changedAt: Date;
  changedBy: string | null;
};

export type AdminInventoryTransaction = {
  id: string;
  variantId: string;
  variantTitle: string;
  change: number;
  reason: string;
  orderId: string | null;
  createdAt: Date;
};

export type AdminProductDetail = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  isFeatured: boolean;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categories: { id: string; name: string }[];
  variants: AdminVariantDetail[];
  specifications: { id: string; key: string; value: string; sortOrder: number }[];
  images: { id: string; url: string; alt: string | null; sortOrder: number; variantId: string | null }[];
  priceHistory: AdminPriceHistoryEntry[];
  inventoryTransactions: AdminInventoryTransaction[];
  orderItemCount: number;
};

export type AdminProductDetailResult =
  | { state: "ok"; data: AdminProductDetail }
  | { state: "notFound" }
  | { state: "error" };

export async function getAdminProductById(
  actor: Actor,
  productId: string
): Promise<AdminProductDetailResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        isFeatured: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { category: { select: { id: true, name: true } } } },
        specifications: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        images: { orderBy: { sortOrder: "asc" } },
        variants: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            sku: true,
            barcode: true,
            price: true,
            compareAtPrice: true,
            costPrice: true,
            weight: true,
            isDefault: true,
            isActive: true,
            sortOrder: true,
            inventory: true,
            _count: { select: { orderItems: true, cartItems: true } },
            priceHistory: {
              orderBy: { changedAt: "desc" },
              take: 50,
              select: {
                id: true,
                price: true,
                compareAtPrice: true,
                changedAt: true,
                changedBy: { select: { displayName: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        _count: { select: { orderItems: true } },
      },
    });
    if (!product) return { state: "notFound" };

    const showCost = canViewCostPrice(actor.role);

    const variants: AdminVariantDetail[] = product.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      costPrice: showCost ? v.costPrice : null,
      weight: v.weight,
      isDefault: v.isDefault,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
      inventory: v.inventory
        ? {
            id: v.inventory.id,
            quantity: v.inventory.quantity,
            reservedQuantity: v.inventory.reservedQuantity,
            lowStockThreshold: v.inventory.lowStockThreshold,
          }
        : null,
      orderItemCount: v._count.orderItems,
      cartItemCount: v._count.cartItems,
    }));

    const variantTitleById = new Map(product.variants.map((v) => [v.id, v.title]));

    const priceHistory: AdminPriceHistoryEntry[] = product.variants.flatMap((v) =>
      v.priceHistory.map((h) => ({
        id: h.id,
        variantId: v.id,
        variantTitle: v.title,
        price: h.price,
        compareAtPrice: h.compareAtPrice,
        changedAt: h.changedAt,
        changedBy: changedByName(h.changedBy),
      }))
    );
    priceHistory.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

    // Inventory audit trail: one query over the product's inventories,
    // newest first, capped — real rows only.
    const inventoryIds = product.variants
      .map((v) => v.inventory?.id)
      .filter((id): id is string => Boolean(id));
    const transactions =
      inventoryIds.length > 0
        ? await prisma.inventoryTransaction.findMany({
            where: { inventoryId: { in: inventoryIds } },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              inventoryId: true,
              change: true,
              reason: true,
              orderId: true,
              createdAt: true,
            },
          })
        : [];

    const inventoryVariantById = new Map(
      product.variants
        .filter((v) => v.inventory)
        .map((v) => [v.inventory!.id, v.id])
    );

    const inventoryTransactions: AdminInventoryTransaction[] = transactions.map((t) => {
      const variantId = inventoryVariantById.get(t.inventoryId) ?? "";
      return {
        id: t.id,
        variantId,
        variantTitle: variantTitleById.get(variantId) ?? "—",
        change: t.change,
        reason: t.reason,
        orderId: t.orderId,
        createdAt: t.createdAt,
      };
    });

    return {
      state: "ok",
      data: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        status: product.status,
        isFeatured: product.isFeatured,
        shortDescription: product.shortDescription,
        description: product.description,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        seoKeywords: product.seoKeywords,
        publishedAt: product.publishedAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        categories: product.categories.map((c) => c.category),
        variants,
        specifications: product.specifications.map((s) => ({
          id: s.id,
          key: s.key,
          value: s.value,
          sortOrder: s.sortOrder,
        })),
        images: product.images.map((i) => ({
          id: i.id,
          url: i.url,
          alt: i.alt,
          sortOrder: i.sortOrder,
          variantId: i.variantId,
        })),
        priceHistory,
        inventoryTransactions,
        orderItemCount: product._count.orderItems,
      },
    };
  } catch {
    return { state: "error" };
  }
}

function changedByName(
  user: { displayName: string | null; firstName: string | null; lastName: string | null } | null
): string | null {
  if (!user) return null;
  if (user.displayName?.trim()) return user.displayName.trim();
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

// ── Internal helpers ───────────────────────────────────────────────────

async function assertCategoriesExist(
  tx: Prisma.TransactionClient,
  categoryIds: string[]
): Promise<boolean> {
  if (categoryIds.length === 0) return true;
  const count = await tx.category.count({ where: { id: { in: categoryIds } } });
  return count === categoryIds.length;
}

function publishFieldFor(status: ProductStatus, existingPublishedAt: Date | null): Date | null {
  if (status !== "ACTIVE") return existingPublishedAt;
  return existingPublishedAt ?? new Date();
}

// ── Product create / update ────────────────────────────────────────────

export async function createProduct(
  actor: Actor,
  raw: ProductInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateProductInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await assertCategoriesExist(tx, input.categoryIds))) return fail("INVALID_CATEGORY");

      try {
        const created = await tx.product.create({
          data: {
            title: input.title,
            slug: input.slug,
            status: input.status as ProductStatus,
            isFeatured: input.isFeatured,
            shortDescription: input.shortDescription,
            description: input.description,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            seoKeywords: input.seoKeywords,
            publishedAt: input.status === "ACTIVE" ? new Date() : null,
            categories: {
              create: input.categoryIds.map((categoryId) => ({ categoryId })),
            },
          },
          select: { id: true },
        });
        return { ok: true as const, data: { id: created.id } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return fail("DUPLICATE_SLUG");
        throw e;
      }
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateProduct(
  actor: Actor,
  productId: string,
  raw: ProductInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateProductInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, status: true, publishedAt: true },
      });
      if (!existing) return fail("NOT_FOUND");

      if (!(await assertCategoriesExist(tx, input.categoryIds))) return fail("INVALID_CATEGORY");

      try {
        await tx.product.update({
          where: { id: productId },
          data: {
            title: input.title,
            slug: input.slug,
            status: input.status as ProductStatus,
            isFeatured: input.isFeatured,
            shortDescription: input.shortDescription,
            description: input.description,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            seoKeywords: input.seoKeywords,
            publishedAt: publishFieldFor(input.status as ProductStatus, existing.publishedAt),
            categories: {
              deleteMany: {},
              create: input.categoryIds.map((categoryId) => ({ categoryId })),
            },
          },
          select: { id: true },
        });
        return { ok: true as const, data: { id: productId } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return fail("DUPLICATE_SLUG");
        throw e;
      }
    });
  } catch {
    return fail("DB_ERROR");
  }
}

// ─ Activate / archive ────────────────────────────────────────────────

export async function setProductStatus(
  actor: Actor,
  productId: string,
  status: unknown
): Promise<ProductMutationResult<{ id: string; status: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const normalized =
    typeof status === "string" && (["DRAFT", "ACTIVE", "ARCHIVED"] as readonly string[]).includes(status)
      ? (status as ProductStatus)
      : null;
  if (!normalized) return fail("VALIDATION");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, publishedAt: true },
      });
      if (!existing) return fail("NOT_FOUND");

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          status: normalized,
          publishedAt: publishFieldFor(normalized, existing.publishedAt),
        },
        select: { id: true, status: true },
      });
      return { ok: true as const, data: { id: updated.id, status: updated.status } };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return fail("NOT_FOUND");
    return fail("DB_ERROR");
  }
}

// ── Delete (conservative) ─────────────────────────────────────────────

export async function deleteProduct(
  actor: Actor,
  productId: string
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!existing) return fail("NOT_FOUND");

      const orderItemCount = await tx.orderItem.count({ where: { productId } });
      const guard = evaluateProductDeletion({ orderItemCount });
      if (!guard.allowed) return fail(guard.reason);

      await tx.product.delete({ where: { id: productId } });
      return { ok: true as const, data: { id: productId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

// ─ Variants ───────────────────────────────────────────────────────────

export async function createVariant(
  actor: Actor,
  productId: string,
  raw: VariantInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateVariantInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) return fail("NOT_FOUND");

      // costPrice is ADMIN-only internal data — STAFF writes carry null.
      const costPrice = canViewCostPrice(actor.role) ? input.costPrice : null;

      try {
        if (input.isDefault) await clearDefaultVariant(tx, productId);

        const created = await tx.productVariant.create({
          data: {
            productId,
            title: input.title,
            sku: input.sku,
            barcode: input.barcode,
            price: input.price,
            compareAtPrice: input.compareAtPrice,
            costPrice,
            weight: input.weight,
            isDefault: input.isDefault,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            inventory: { create: {} },
          },
          select: { id: true },
        });
        return { ok: true as const, data: { id: created.id } };
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "P2002") return fail(duplicateVariantError(e));
        throw e;
      }
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateVariant(
  actor: Actor,
  variantId: string,
  raw: VariantInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateVariantInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          productId: true,
          price: true,
          compareAtPrice: true,
          isDefault: true,
        },
      });
      if (!existing) return fail("NOT_FOUND");

      const showCost = canViewCostPrice(actor.role);

      try {
        if (input.isDefault && !existing.isDefault) {
          await clearDefaultVariant(tx, existing.productId);
        }

        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            title: input.title,
            sku: input.sku,
            barcode: input.barcode,
            price: input.price,
            compareAtPrice: input.compareAtPrice,
            // STAFF cannot change cost; ADMIN writes the submitted value.
            ...(showCost ? { costPrice: input.costPrice } : {}),
            weight: input.weight,
            isDefault: input.isDefault,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
          },
          select: { id: true },
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "P2002") return fail(duplicateVariantError(e));
        throw e;
      }

      // Price history: ONLY on a real change (pure diff decides).
      const point = derivePricePoint(
        { price: existing.price, compareAtPrice: existing.compareAtPrice },
        { price: input.price, compareAtPrice: input.compareAtPrice }
      );
      if (point) {
        await tx.productPriceHistory.create({
          data: {
            variantId,
            price: point.price,
            compareAtPrice: point.compareAtPrice,
            changedById: actor.id,
          },
        });
      }

      return { ok: true as const, data: { id: variantId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function deleteVariant(
  actor: Actor,
  variantId: string
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true },
      });
      if (!existing) return fail("NOT_FOUND");

      const [orderItemCount, cartItemCount] = await Promise.all([
        tx.orderItem.count({ where: { variantId } }),
        tx.cartItem.count({ where: { variantId } }),
      ]);
      const guard = evaluateVariantDeletion({ orderItemCount, cartItemCount });
      if (!guard.allowed) return fail(guard.reason);

      await tx.productVariant.delete({ where: { id: variantId } });

      // Keep exactly one default when the removed variant was it.
      const remaining = await tx.productVariant.findMany({
        where: { productId: existing.productId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, isDefault: true },
      });
      if (remaining.length > 0 && !remaining.some((v) => v.isDefault)) {
        await tx.productVariant.update({
          where: { id: remaining[0].id },
          data: { isDefault: true },
          select: { id: true },
        });
      }
      return { ok: true as const, data: { id: variantId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

async function clearDefaultVariant(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.productVariant.updateMany({
    where: { productId, isDefault: true },
    data: { isDefault: false },
  });
}

function duplicateVariantError(e: unknown): ProductErrorCode {
  const meta = (e as { meta?: { target?: string[] | string } }).meta;
  const target = meta?.target;
  const joined = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (joined.includes("barcode")) return "DUPLICATE_BARCODE";
  return "DUPLICATE_SKU";
}

// ─ Specifications ─────────────────────────────────────────────────────

export async function createSpecification(
  actor: Actor,
  productId: string,
  raw: SpecificationInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateSpecificationInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) return fail("NOT_FOUND");

      const existing = await tx.productSpecification.findMany({
        where: { productId },
        select: { key: true },
      });
      if (hasDuplicateSpecKey(existing.map((s) => s.key), input.key)) {
        return fail("DUPLICATE_SPEC_KEY", { key: "این عنوان ویژگی قبلاً ثبت شده است." });
      }

      try {
        const created = await tx.productSpecification.create({
          data: { productId, key: input.key, value: input.value, sortOrder: input.sortOrder },
          select: { id: true },
        });
        return { ok: true as const, data: { id: created.id } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return fail("DUPLICATE_SPEC_KEY");
        throw e;
      }
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateSpecification(
  actor: Actor,
  specificationId: string,
  raw: SpecificationInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateSpecificationInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productSpecification.findUnique({
        where: { id: specificationId },
        select: { id: true, productId: true, key: true },
      });
      if (!existing) return fail("NOT_FOUND");

      const keyChanged = normalizeSpecKey(existing.key) !== normalizeSpecKey(input.key);
      if (keyChanged) {
        const rows = await tx.productSpecification.findMany({
          where: { productId: existing.productId, NOT: { id: specificationId } },
          select: { key: true },
        });
        if (hasDuplicateSpecKey(rows.map((s) => s.key), input.key)) {
          return fail("DUPLICATE_SPEC_KEY", { key: "این عنوان ویژگی قبلاً ثبت شده است." });
        }
      }

      try {
        await tx.productSpecification.update({
          where: { id: specificationId },
          data: { key: input.key, value: input.value, sortOrder: input.sortOrder },
          select: { id: true },
        });
        return { ok: true as const, data: { id: specificationId } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return fail("DUPLICATE_SPEC_KEY");
        throw e;
      }
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function deleteSpecification(
  actor: Actor,
  specificationId: string
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");
  try {
    const existing = await prisma.productSpecification.findUnique({
      where: { id: specificationId },
      select: { id: true },
    });
    if (!existing) return fail("NOT_FOUND");
    await prisma.productSpecification.delete({ where: { id: specificationId } });
    return { ok: true, data: { id: specificationId } };
  } catch {
    return fail("DB_ERROR");
  }
}

// ─ Media / images (URL-based only) ───────────────────────────────────

export async function addProductImage(
  actor: Actor,
  productId: string,
  raw: MediaInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateMediaInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) return fail("NOT_FOUND");

      if (input.variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: input.variantId, productId },
          select: { id: true },
        });
        if (!variant) return fail("INVALID_VARIANT");
      }

      const existing = await tx.productImage.findMany({
        where: { productId },
        select: { id: true, sortOrder: true },
      });
      if (!canAddMedia(existing.length)) return fail("MEDIA_LIMIT");

      const sortOrder = input.sortOrder || nextMediaSortOrder(existing);

      const created = await tx.productImage.create({
        data: { productId, url: input.url, alt: input.alt, sortOrder, variantId: input.variantId },
        select: { id: true },
      });
      return { ok: true as const, data: { id: created.id } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateProductImage(
  actor: Actor,
  imageId: string,
  raw: MediaInputRaw
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateMediaInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productImage.findUnique({
        where: { id: imageId },
        select: { id: true, productId: true },
      });
      if (!existing) return fail("NOT_FOUND");

      if (input.variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: input.variantId, productId: existing.productId },
          select: { id: true },
        });
        if (!variant) return fail("INVALID_VARIANT");
      }

      await tx.productImage.update({
        where: { id: imageId },
        data: { url: input.url, alt: input.alt, sortOrder: input.sortOrder, variantId: input.variantId },
        select: { id: true },
      });
      return { ok: true as const, data: { id: imageId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function deleteProductImage(
  actor: Actor,
  imageId: string
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");
  try {
    const existing = await prisma.productImage.findUnique({ where: { id: imageId }, select: { id: true } });
    if (!existing) return fail("NOT_FOUND");
    await prisma.productImage.delete({ where: { id: imageId } });
    return { ok: true, data: { id: imageId } };
  } catch {
    return fail("DB_ERROR");
  }
}

/**
 * "Make primary": the schema has no primary flag — the storefront's first
 * image is the primary one, so ordering is the single source of truth.
 * Renumbers 0..n-1 so the chosen image is first.
 */
export async function setPrimaryProductImage(
  actor: Actor,
  imageId: string
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productImage.findUnique({
        where: { id: imageId },
        select: { id: true, productId: true },
      });
      if (!existing) return fail("NOT_FOUND");

      const rows = await tx.productImage.findMany({
        where: { productId: existing.productId },
        select: { id: true, sortOrder: true },
      });
      const ordered = moveMediaToFront(rows, imageId);
      for (const item of ordered) {
        await tx.productImage.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
          select: { id: true },
        });
      }
      return { ok: true as const, data: { id: imageId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

// ── Inventory (restock / adjustment) ──────────────────────────────────

/**
 * Apply a restock or signed adjustment to a variant's inventory. Runs in a
 * transaction with a guarded update (mirrors the checkout concurrency
 * pattern) and always writes an audited InventoryTransaction row. On-hand
 * stock can never fall below reserved orders or below zero.
 */
export async function adjustVariantInventory(
  actor: Actor,
  variantId: string,
  raw: InventoryInputRaw
): Promise<ProductMutationResult<{ quantity: number }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const validation = validateInventoryInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          inventory: { select: { id: true, quantity: true, reservedQuantity: true } },
        },
      });
      if (!variant) return fail("NOT_FOUND");

      // Every variant created through this module has an inventory row; a
      // legacy variant without one is created lazily here so adjustments
      // remain possible without unsafe direct writes.
      const inventory =
        variant.inventory ??
        (await tx.inventory.create({
          data: { variantId },
          select: { id: true, quantity: true, reservedQuantity: true },
        }));

      const applied = applyInventoryChange(
        { quantity: inventory.quantity, reservedQuantity: inventory.reservedQuantity },
        input.delta
      );
      if (!applied.ok) {
        return fail(applied.reason === "BELOW_RESERVED" ? "INVENTORY_BELOW_RESERVED" : "INVENTORY_NEGATIVE");
      }

      const updated = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantity: inventory.quantity,
          reservedQuantity: inventory.reservedQuantity,
        },
        data: { quantity: applied.quantity },
      });
      if (updated.count !== 1) throw new Error("INVENTORY_STALE");

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          change: input.delta,
          reason: input.reason,
        },
      });

      return { ok: true as const, data: { quantity: applied.quantity } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

/** Update a variant's low-stock threshold (real schema field). */
export async function updateInventoryThreshold(
  actor: Actor,
  variantId: string,
  rawThreshold: unknown
): Promise<ProductMutationResult<{ id: string }>> {
  if (!canManageProducts(actor)) return fail("FORBIDDEN");

  const parsed =
    typeof rawThreshold === "string" && rawThreshold.trim()
      ? parseStrictInt(rawThreshold)
      : null;
  if (parsed === null || parsed < 0 || parsed > 1_000_000) {
    return fail("VALIDATION", { lowStockThreshold: "آستانه موجودی کم معتبر نیست." });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, inventory: { select: { id: true } } },
      });
      if (!variant) return fail("NOT_FOUND");
      if (!variant.inventory) {
        await tx.inventory.create({ data: { variantId, lowStockThreshold: parsed }, select: { id: true } });
      } else {
        await tx.inventory.update({
          where: { id: variant.inventory.id },
          data: { lowStockThreshold: parsed },
          select: { id: true },
        });
      }
      return { ok: true as const, data: { id: variantId } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export type { NormalizedProductInput };
export { PRODUCT_ERROR_MESSAGES } from "./product-rules.ts";