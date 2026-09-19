// Blog category management service — server-only Prisma adapter for the
// pure blog category rules (./category-rules.ts). Phase 15.
//
// Reuse policy: the pure validation/hierarchy primitives are shared with the
// product catalog (src/lib/admin/category-rules.ts) — one validation system,
// two category trees. Only the write target (prisma.postCategory), the post
// counts and the blog-specific deletion guard vocabulary live here.
//
// Security model (mirrors catalog category-service):
//   - every mutation receives an actor resolved SERVER-SIDE by the action
//     layer (requireAdminForAction → the DB user row); the role is
//     re-checked here with the existing ADMIN/STAFF allow-list — client
//     input never carries authorization facts
//   - raw form values never reach Prisma directly: the shared
//     validatePostCategoryInput (the catalog validator, re-exported by the
//     blog rules) normalizes/whitelists them first
//   - hierarchy integrity (self-parent, cycles, unknown parents) is
//     checked against the LIVE rows before any write, inside the same
//     transaction when a reparent occurs
//   - deletion is conservative (children / attached posts block it),
//     matching the schema's onDelete: Restrict on the parent link
//   - `level` is kept consistent with the parent chain on create and on
//     reparent (subtree levels are recomputed)
//   - DB failures map to stable machine codes with Persian copy — admin
//     never sees raw database errors, and no fake data is substituted

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, CategoryStatus } from "@prisma/client";
import { isAdminCapableRole } from "../admin/rules.ts";
import {
  validatePostCategoryInput,
  validateParentAssignment,
  recomputeSubtreeLevels,
  evaluatePostCategoryDeletion,
  POST_CATEGORY_STATUSES,
} from "./category-rules.ts";
import type {
  PostCategoryErrorCode,
  PostCategoryInputRaw,
  PostCategoryLevelRow,
  AdminPostCategoryNode,
} from "./category-rules.ts";

export type PostCategoryMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: PostCategoryErrorCode; fieldErrors?: Record<string, string> };

type Actor = { id: string; role: string };

function canManagePostCategories(actor: Actor): boolean {
  // Content management uses the existing ADMIN/STAFF allow-list.
  return isAdminCapableRole(actor.role);
}

function failResult(code: PostCategoryErrorCode): PostCategoryMutationResult<never> {
  return { ok: false, error: code };
}

// ── Reads (admin tree: ALL statuses, ordered like the public tree) ─────

export type { AdminPostCategoryNode };

export type AdminPostCategoryTreeResult =
  | { state: "ok"; categories: AdminPostCategoryNode[] }
  | { state: "error" };

/**
 * Full blog category tree for the admin console. Counts attached posts of
 * ANY status (a draft post still blocks deletion — see the guard — and the
 * admin must see the real number), plus the subtree roll-up for display.
 */
export async function getAdminPostCategoryTree(): Promise<AdminPostCategoryTreeResult> {
  try {
    const [rows, counts] = await Promise.all([
      prisma.postCategory.findMany({
        orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.postCategoryRelation.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
      }),
    ]);
    const postCountByCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));

    // Subtree roll-up: total posts in this category + all its descendants.
    const childOf = new Map<string, string[]>();
    for (const row of rows) {
      if (row.parentId == null) continue;
      const list = childOf.get(row.parentId) ?? [];
      list.push(row.id);
      childOf.set(row.parentId, list);
    }
    const total = (id: string): number => {
      let sum = postCountByCategory.get(id) ?? 0;
      for (const child of childOf.get(id) ?? []) sum += total(child);
      return sum;
    };

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
        postCount: postCountByCategory.get(c.id) ?? 0,
        totalPostCount: total(c.id),
      })),
    };
  } catch {
    return { state: "error" };
  }
}

// ── Internal helpers ───────────────────────────────────────────────────

async function loadLevelRows(
  tx: Prisma.TransactionClient | typeof prisma
): Promise<PostCategoryLevelRow[]> {
  return tx.postCategory.findMany({ select: { id: true, parentId: true, level: true } });
}

// ── Create ─────────────────────────────────────────────────────────────

export async function createPostCategory(
  actor: Actor,
  raw: PostCategoryInputRaw
): Promise<PostCategoryMutationResult<{ id: string }>> {
  if (!canManagePostCategories(actor)) return failResult("FORBIDDEN");

  const validation = validatePostCategoryInput({ ...raw, parentId: raw.parentId ?? null });
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
        const created = await tx.postCategory.create({
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
          select: { id: true },
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

export async function updatePostCategory(
  actor: Actor,
  categoryId: string,
  raw: PostCategoryInputRaw
): Promise<PostCategoryMutationResult<{ id: string }>> {
  if (!canManagePostCategories(actor)) return failResult("FORBIDDEN");

  const validation = validatePostCategoryInput(raw);
  if (!validation.ok) return { ok: false, error: "VALIDATION", fieldErrors: validation.errors };
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.postCategory.findUnique({ where: { id: categoryId } });
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
        await tx.postCategory.update({
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
          select: { id: true },
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
          await tx.postCategory.update({ where: { id: change.id }, data: { level: change.level } });
        }
      }

      return { ok: true as const, data: { id: categoryId } };
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

// ── Activate / deactivate (existing CategoryStatus enum only) ──────────

export async function setPostCategoryStatus(
  actor: Actor,
  categoryId: string,
  status: unknown
): Promise<PostCategoryMutationResult<{ id: string; status: string }>> {
  if (!canManagePostCategories(actor)) return failResult("FORBIDDEN");

  const normalized: CategoryStatus | null =
    typeof status === "string" && (POST_CATEGORY_STATUSES as readonly string[]).includes(status)
      ? (status as CategoryStatus)
      : null;
  if (!normalized) return failResult("VALIDATION");

  try {
    const updated = await prisma.postCategory.update({
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

export async function deletePostCategory(
  actor: Actor,
  categoryId: string
): Promise<PostCategoryMutationResult<{ id: string }>> {
  if (!canManagePostCategories(actor)) return failResult("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.postCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!existing) return failResult("NOT_FOUND");

      const [childCount, postCount] = await Promise.all([
        tx.postCategory.count({ where: { parentId: categoryId } }),
        tx.postCategoryRelation.count({ where: { categoryId } }),
      ]);
      const guard = evaluatePostCategoryDeletion({ childCount, postCount });
      if (!guard.allowed) return failResult(guard.reason);

      await tx.postCategory.delete({ where: { id: categoryId } });
      return { ok: true as const, data: { id: categoryId } };
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

// ── Author options (admin/staff users eligible as post authors) ────────

export type PostAuthorOption = { id: string; name: string };

export async function getPostAuthorOptions(): Promise<PostAuthorOption[]> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { phone: "asc" }],
      select: { id: true, firstName: true, lastName: true, displayName: true, phone: true },
    });
    return users.map((u) => ({
      id: u.id,
      name:
        u.displayName?.trim() ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.phone,
    }));
  } catch {
    return [];
  }
}
