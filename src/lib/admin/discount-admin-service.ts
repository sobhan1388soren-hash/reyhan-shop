// Discount administration service — server-only read queries + adapters
// over the EXISTING discount service (src/lib/discounts/service.ts).
// Phase 14, Part 2.
//
// No discount calculation/eligibility logic lives here — the existing pure
// rules and service remain the single source of truth. This module only
// adds admin list reads and maps validation/service outcomes to stable
// machine codes.

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, DiscountType, DiscountScope } from "@prisma/client";
import {
  createDiscount,
  updateDiscount,
  setDiscountActive,
  getDiscountUsage,
} from "@/lib/discounts/service";
import {
  validateDiscountAdminInput,
  derivedDiscountStatus,
} from "./discount-admin-rules.ts";
import type {
  DiscountAdminErrorCode,
  DiscountAdminInputRaw,
} from "./discount-admin-rules.ts";
import type { DiscountDisplayStatus } from "./labels.ts";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";

export type Actor = { id: string; role: string };

export type DiscountAdminResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: DiscountAdminErrorCode; fieldErrors?: Record<string, string> };

function fail(
  error: DiscountAdminErrorCode,
  fieldErrors?: Record<string, string>
): DiscountAdminResult<never> {
  return { ok: false, error, fieldErrors };
}

// ── Reads ──────────────────────────────────────────────────────────────

export const ADMIN_DISCOUNT_SORTS = [
  "created_desc",
  "created_asc",
  "code_asc",
  "usage_desc",
] as const;
export type AdminDiscountSort = (typeof ADMIN_DISCOUNT_SORTS)[number];

export type AdminDiscountListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: DiscountDisplayStatus;
  type?: DiscountType;
  sort: AdminDiscountSort;
};

export type AdminDiscountRow = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  displayStatus: DiscountDisplayStatus;
  createdAt: Date;
};

export type AdminDiscountListResult =
  | { state: "ok"; rows: AdminDiscountRow[]; meta: PaginationMeta }
  | { state: "error" };

function statusWhere(status: DiscountDisplayStatus, now: Date): Prisma.DiscountWhereInput {
  switch (status) {
    case "INACTIVE":
      return { isActive: false };
    case "SCHEDULED":
      return { isActive: true, startsAt: { gt: now } };
    case "EXPIRED":
      return { isActive: true, endsAt: { lt: now } };
    case "ACTIVE":
    default:
      return {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      };
  }
}

function discountOrderBy(sort: AdminDiscountSort): Prisma.DiscountOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "code_asc":
      return { code: "asc" };
    case "usage_desc":
      return { usedCount: "desc" };
    case "created_desc":
    default:
      return { createdAt: "desc" };
  }
}

export async function getAdminDiscounts(
  filters: AdminDiscountListFilters
): Promise<AdminDiscountListResult> {
  try {
    const now = new Date();
    const where: Prisma.DiscountWhereInput = {};
    if (filters.status) {
      Object.assign(where, statusWhere(filters.status, now));
    }
    if (filters.type) where.type = filters.type;
    if (filters.q) where.code = { contains: filters.q, mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        orderBy: discountOrderBy(filters.sort),
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.discount.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: d.value,
        scope: d.scope,
        minOrderAmount: d.minOrderAmount,
        maxDiscountAmount: d.maxDiscountAmount,
        maxUses: d.maxUses,
        usedCount: d.usedCount,
        maxUsesPerUser: d.maxUsesPerUser,
        isActive: d.isActive,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        displayStatus: derivedDiscountStatus({
          isActive: d.isActive,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          now,
        }),
        createdAt: d.createdAt,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminDiscountDetail = AdminDiscountRow & {
  updatedAt: Date;
  usages: { id: string; orderId: string | null; userId: string | null; usedAt: Date }[];
};

export type AdminDiscountDetailResult =
  | { state: "ok"; data: AdminDiscountDetail }
  | { state: "notFound" }
  | { state: "error" };

export async function getAdminDiscountById(
  discountId: string
): Promise<AdminDiscountDetailResult> {
  try {
    const discount = await prisma.discount.findUnique({
      where: { id: discountId },
      include: {
        usages: {
          orderBy: { usedAt: "desc" },
          take: 50,
          select: { id: true, orderId: true, userId: true, usedAt: true },
        },
      },
    });
    if (!discount) return { state: "notFound" };

    const now = new Date();
    return {
      state: "ok",
      data: {
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        scope: discount.scope,
        minOrderAmount: discount.minOrderAmount,
        maxDiscountAmount: discount.maxDiscountAmount,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
        maxUsesPerUser: discount.maxUsesPerUser,
        isActive: discount.isActive,
        startsAt: discount.startsAt,
        endsAt: discount.endsAt,
        displayStatus: derivedDiscountStatus({
          isActive: discount.isActive,
          startsAt: discount.startsAt,
          endsAt: discount.endsAt,
          now,
        }),
        createdAt: discount.createdAt,
        updatedAt: discount.updatedAt,
        usages: discount.usages,
      },
    };
  } catch {
    return { state: "error" };
  }
}

// ── Mutations (delegate to the existing discount service) ─────────────

function mapServiceError(error: string): DiscountAdminErrorCode {
  switch (error) {
    case "FORBIDDEN":
      return "FORBIDDEN";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "DUPLICATE_CODE":
      return "DUPLICATE_CODE";
    case "INVALID_INPUT":
      return "VALIDATION";
    default:
      return "DB_ERROR";
  }
}

export async function createDiscountAdmin(
  actor: Actor,
  raw: DiscountAdminInputRaw
): Promise<DiscountAdminResult<{ id: string }>> {
  const validation = validateDiscountAdminInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    const result = await createDiscount(actor, {
      code: input.code,
      type: input.type,
      value: input.value,
      minOrderAmount: input.minOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount,
      maxUses: input.maxUses,
      maxUsesPerUser: input.maxUsesPerUser,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
    });
    if (!result.ok) return fail(mapServiceError(result.error));
    return { ok: true, data: { id: result.discount.id } };
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateDiscountAdmin(
  actor: Actor,
  discountId: string,
  raw: DiscountAdminInputRaw
): Promise<DiscountAdminResult<{ id: string }>> {
  const validation = validateDiscountAdminInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    const result = await updateDiscount(actor, discountId, {
      code: input.code,
      type: input.type,
      value: input.value,
      minOrderAmount: input.minOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount,
      maxUses: input.maxUses,
      maxUsesPerUser: input.maxUsesPerUser,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
    });
    if (!result.ok) return fail(mapServiceError(result.error));
    return { ok: true, data: { id: result.discount.id } };
  } catch {
    return fail("DB_ERROR");
  }
}

export async function setDiscountActiveAdmin(
  actor: Actor,
  discountId: string,
  isActive: boolean
): Promise<DiscountAdminResult<{ id: string; isActive: boolean }>> {
  try {
    const result = await setDiscountActive(actor, discountId, isActive);
    if (!result.ok) return fail(mapServiceError(result.error));
    return { ok: true, data: { id: result.discount.id, isActive: result.discount.isActive } };
  } catch {
    return fail("DB_ERROR");
  }
}

export type DiscountUsageAdmin = {
  usedCount: number;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  recentUsages: { id: string; usedAt: Date; orderId: string | null }[];
};

export async function getDiscountUsageAdmin(
  actor: Actor,
  discountId: string
): Promise<DiscountAdminResult<DiscountUsageAdmin>> {
  try {
    const result = await getDiscountUsage(actor, discountId);
    if (!result.ok) return fail(mapServiceError(result.error));
    return { ok: true, data: result.usage };
  } catch {
    return fail("DB_ERROR");
  }
}