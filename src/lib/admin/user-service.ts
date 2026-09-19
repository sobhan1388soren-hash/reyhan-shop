// Customer/user administration service — server-only Prisma adapter for
// the pure user rules (./user-admin-rules). Phase 14, Part 2.
//
// Every mutation is ADMIN-only (existing USER_MANAGEMENT_ROLES) and guarded
// against self-lockout and last-admin lockout. Sensitive authentication data
// (passwords, OTP, sessions) is never touched here.

import "server-only";
import prisma from "@/lib/prisma";
import {
  evaluateUserStatusChange,
  evaluateUserRoleChange,
  isManageableStatus,
  isAssignableRole,
} from "./user-admin-rules.ts";
import type { UserAdminErrorCode } from "./user-admin-rules.ts";

export type Actor = { id: string; role: string };

export type UserMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: UserAdminErrorCode };

function fail(code: UserAdminErrorCode): UserMutationResult<never> {
  return { ok: false, error: code };
}

async function loadTargetAndAdminCount(userId: string) {
  const [target, activeAdminCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    }),
    prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
  ]);
  return { target, activeAdminCount };
}

/** Block / unblock a user (ACTIVE ↔ BLOCKED). ADMIN-only. */
export async function setUserStatus(
  actor: Actor,
  userId: string,
  status: unknown
): Promise<UserMutationResult<{ id: string; status: string }>> {
  if (typeof status !== "string" || !isManageableStatus(status)) return fail("INVALID");

  try {
    const { target, activeAdminCount } = await loadTargetAndAdminCount(userId);
    if (!target) return fail("NOT_FOUND");

    const evaluation = evaluateUserStatusChange(
      {
        actorId: actor.id,
        actorRole: actor.role,
        targetId: target.id,
        targetRole: target.role,
        targetStatus: target.status,
        activeAdminCount,
      },
      status
    );
    if (!evaluation.ok) return fail(evaluation.code);

    if (target.status !== status) {
      await prisma.user.update({ where: { id: userId }, data: { status } });
    }
    return { ok: true, data: { id: userId, status } };
  } catch {
    return fail("DB_ERROR");
  }
}

/** Change a user's role (CUSTOMER / ADMIN / STAFF). ADMIN-only. */
export async function setUserRole(
  actor: Actor,
  userId: string,
  role: unknown
): Promise<UserMutationResult<{ id: string; role: string }>> {
  if (typeof role !== "string" || !isAssignableRole(role)) return fail("INVALID");

  try {
    const { target, activeAdminCount } = await loadTargetAndAdminCount(userId);
    if (!target) return fail("NOT_FOUND");

    const evaluation = evaluateUserRoleChange(
      {
        actorId: actor.id,
        actorRole: actor.role,
        targetId: target.id,
        targetRole: target.role,
        targetStatus: target.status,
        activeAdminCount,
      },
      role
    );
    if (!evaluation.ok) return fail(evaluation.code);

    if (target.role !== role) {
      await prisma.user.update({ where: { id: userId }, data: { role } });
    }
    return { ok: true, data: { id: userId, role } };
  } catch {
    return fail("DB_ERROR");
  }
}