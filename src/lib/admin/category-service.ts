// Category management service — server-only Prisma adapter for the pure
// category rules (./category-rules). Phase 14-B.
//
// Security model (mirrors discounts/reviews conventions):
//   - every mutation receives an actor resolved SERVER-SIDE by the action
//     layer (requireAdminForAction → the DB user row); the role is
//     re-checked here with the existing ADMIN/STAFF allow-list — client
//     input never carries authorization facts
//   - raw form values never reach Prisma directly: validateCategoryInput
//     normalizes/whitelists them first
//   - hierarchy integrity (self-parent, cycles, unknown parents) is
//     checked against the LIVE category rows before any write, inside the
//     same transaction when a reparent occurs
//   - deletion is conservative (children / product associations block it),
//     matching the schema's onDelete: Restrict on the parent link
//   - `level` is kept consistent with the parent chain on create and on
//     reparent (subtree levels are recomputed)
//   - DB failures map to stable machine codes with Persian copy — admin
//     never sees raw database errors, and no fake data is substituted

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, CategoryStatus } from "@prisma/client";
import { isAdminCapableRole } from "./rules.ts";
import {
  validateCategoryInput,
  validateParentAssignment,
  recomputeSubtreeLevels,
  evaluateCategoryDeletion,
  CATEGORY_STATUSES,
} from "./category-rules.ts";
import type {
  CategoryErrorCode,
  CategoryInputRaw,
  CategoryLevelRow,
  AdminCategoryNode,
} from "./category-rules.ts";

export type CategoryMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: CategoryErrorCode; fieldErrors?: Record<string, string> };

type Actor = { id: string; role: string };

function canManageCategories(actor: Actor): boolean {
  // Store-management capability: the existing ADMIN/STAFF allow-list.
  return isAdminCapableRole(actor.role);
}

// ── Reads (admin tree: ALL statuses, ordered like the public tree) ─────

export type { AdminCategoryNode };

export type AdminCategoryTreeResult =
  | { state: "ok"; categories: AdminCategoryNode[] }
  | { state: "error" };

export async function getAdminCategoryTree(): Promise<AdminCategoryTreeResult> {
  try {
    const [rows, counts] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.productCategory.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
      }),
    ]);
    const productCountByCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return {
      state: "ok",
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image,
        status: c.status,
        sortOrder: c.sortOrder,
        level: c.level,
        parentId: c.parentId,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        productCount: productCountByCategory.get(c.id) ?? 0,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

// ── Internal helpers ───────────────────────────────────────────────────

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.CategorySelect;

async function loadLevelRows(
  tx: Prisma.TransactionClient | typeof prisma
): Promise<CategoryLevelRow[]> {
  const rows = await tx.category.findMany({ select: { id: true, parentId: true, level: true } });
  return rows;
}

/** Map a validated input + hierarchy outcome into a stable error, or null. */
function failResult(code: CategoryErrorCode): CategoryMutationResult<never> {
  return { ok: false, error: code };
}

// ── Create ─────────────────────────────────────────────────────────────

export async function createCategory(
  actor: Actor,
  raw: CategoryInputRaw
): Promise<CategoryMutationResult<{ id: string }>> {
  if (!canManageCategories(actor)) return failResult("FORBIDDEN");

  const validation = validateCategoryInput({ ...raw, parentId: raw.parentId ?? null });
  if (!validation.ok) return { ok: false, error: "VALIDATION", fieldErrors: validation.errors };
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await loadLevelRows(tx);

      if (input.parentId !== null) {
        const parent = rows.find((r) => r.id === input.parentId);
        if (!parent) return failResult("INVALID_PARENT");
      }

      const level =
        input.parentId === null
          ? 0
          : rows.find((r) => r.id === input.parentId)!.level + 1;

      try {
        const created = await tx.category.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            image: input.image,
            status: input.status as CategoryStatus,
            sortOrder: input.sortOrder,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            parentId: input.parentId,
            level,
          },
          select: CATEGORY_SELECT,
        });
        return { ok: true as const, data: { id: created.id } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return failResult("DUPLICATE_SLUG");
        throw e;
      }
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

// ── Update (content + optional reparent + reorder) ─────────────────────

export async function updateCategory(
  actor: Actor,
  categoryId: string,
  raw: CategoryInputRaw
): Promise<CategoryMutationResult<{ id: string }>> {
  if (!canManageCategories(actor)) return failResult("FORBIDDEN");

  const validation = validateCategoryInput(raw);
  if (!validation.ok) return { ok: false, error: "VALIDATION", fieldErrors: validation.errors };
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id: categoryId } });
      if (!existing) return failResult("NOT_FOUND");

      const rows = await loadLevelRows(tx);

      const newParentId = input.parentId;
      const reparent = newParentId !== existing.parentId;

      if (reparent) {
        const violation = validateParentAssignment(rows, categoryId, newParentId);
        if (violation) return failResult("INVALID_PARENT");
      }

      const newLevel =
        newParentId === null ? 0 : rows.find((r) => r.id === newParentId)!.level + 1;

      try {
        await tx.category.update({
          where: { id: categoryId },
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            image: input.image,
            status: input.status as CategoryStatus,
            sortOrder: input.sortOrder,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            parentId: newParentId,
            ...(reparent ? { level: newLevel } : {}),
          },
          select: CATEGORY_SELECT,
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return failResult("DUPLICATE_SLUG");
        throw e;
      }

      if (reparent) {
        // Subtree levels follow the moved root (pure, in-memory diff).
        const merged = rows.map((r) =>
          r.id === categoryId ? { ...r, parentId: newParentId, level: newLevel } : r
        );
        const changes = recomputeSubtreeLevels(merged, categoryId, newLevel);
        for (const change of changes) {
          if (change.id === categoryId) continue; // already written above
          await tx.category.update({ where: { id: change.id }, data: { level: change.level } });
        }
      }

      return { ok: true as const, data: { id: categoryId } };
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

// ── Activate / deactivate (existing CategoryStatus enum only) ──────────

export async function setCategoryStatus(
  actor: Actor,
  categoryId: string,
  status: unknown
): Promise<CategoryMutationResult<{ id: string; status: string }>> {
  if (!canManageCategories(actor)) return failResult("FORBIDDEN");

  const normalized: CategoryStatus | null =
    typeof status === "string" && (CATEGORY_STATUSES as readonly string[]).includes(status)
      ? (status as CategoryStatus)
      : null;
  if (!normalized) return failResult("VALIDATION");

  try {
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { status: normalized },
      select: { id: true, status: true },
    });
    return { ok: true, data: { id: updated.id, status: updated.status } };
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return failResult("NOT_FOUND");
    return failResult("DB_ERROR");
  }
}

// ── Delete (conservative) ──────────────────────────────────────────────

export async function deleteCategory(
  actor: Actor,
  categoryId: string
): Promise<CategoryMutationResult<{ id: string }>> {
  if (!canManageCategories(actor)) return failResult("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!existing) return failResult("NOT_FOUND");

      const [childCount, productCount] = await Promise.all([
        tx.category.count({ where: { parentId: categoryId } }),
        tx.productCategory.count({ where: { categoryId } }),
      ]);
      const guard = evaluateCategoryDeletion({ childCount, productCount });
      if (!guard.allowed) return failResult(guard.reason);

      await tx.category.delete({ where: { id: categoryId } });
      return { ok: true as const, data: { id: categoryId } };
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

