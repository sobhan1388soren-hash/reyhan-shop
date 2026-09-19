// Customer/user administration domain — pure, DB-free rules (Phase 14,
// Part 2).
//
// Authorization reuses the existing Phase 13 allow-list
// (USER_MANAGEMENT_ROLES = ["ADMIN"] via canManageUsersRole) — no second
// permission system is introduced. Only the real schema enums are accepted.
//
// Integrity guards (defensive, not new product rules):
//   - an admin may not block or demote their own account (self-lockout)
//   - the last active ADMIN may not be blocked or demoted (console lockout)
//
// Sensitive auth operations (passwords, OTP, sessions, deletion) are
// deliberately NOT part of this module.

import type { UserRole, UserStatus } from "@prisma/client";
import { canManageUsersRole } from "./rules.ts";

/** Roles an admin may assign — exactly the schema's UserRole enum. */
export const ASSIGNABLE_ROLES = ["CUSTOMER", "ADMIN", "STAFF"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Statuses an admin may set — DELETED is excluded (no destructive delete). */
export const MANAGEABLE_STATUSES = ["ACTIVE", "BLOCKED"] as const;
export type ManageableStatus = (typeof MANAGEABLE_STATUSES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function isManageableStatus(status: string): status is ManageableStatus {
  return (MANAGEABLE_STATUSES as readonly string[]).includes(status);
}

export type UserAdminErrorCode =
  | "FORBIDDEN"
  | "INVALID"
  | "SELF"
  | "LAST_ADMIN"
  | "NOT_FOUND"
  | "DB_ERROR";

export const USER_ADMIN_MESSAGES: Readonly<Record<UserAdminErrorCode, string>> = {
  FORBIDDEN: "شما به مدیریت کاربران دسترسی ندارید.",
  INVALID: "مقدار درخواستی معتبر نیست.",
  SELF: "نمی‌توانید وضعیت یا نقش حساب خودتان را تغییر دهید.",
  LAST_ADMIN: "این تنها مدیر فعال سامانه است؛ مسدودسازی یا تغییر نقش آن باعث قطع دسترسی مدیریت می‌شود.",
  NOT_FOUND: "کاربر موردنظر یافت نشد.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};

export type UserMutationFacts = {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetRole: UserRole;
  targetStatus: UserStatus;
  /** Count of ACTIVE users with role ADMIN (includes the target). */
  activeAdminCount: number;
};

export type UserMutationEvaluation = { ok: true } | { ok: false; code: UserAdminErrorCode };

/** Block / unblock authorization + integrity guards. */
export function evaluateUserStatusChange(
  facts: UserMutationFacts,
  nextStatus: string
): UserMutationEvaluation {
  if (!canManageUsersRole(facts.actorRole)) return { ok: false, code: "FORBIDDEN" };
  if (!isManageableStatus(nextStatus)) return { ok: false, code: "INVALID" };
  if (nextStatus === facts.targetStatus) return { ok: true };

  if (facts.targetId === facts.actorId && nextStatus === "BLOCKED") {
    return { ok: false, code: "SELF" };
  }
  if (
    facts.targetRole === "ADMIN" &&
    nextStatus === "BLOCKED" &&
    facts.activeAdminCount <= 1
  ) {
    return { ok: false, code: "LAST_ADMIN" };
  }
  return { ok: true };
}

/** Role-change authorization + integrity guards. */
export function evaluateUserRoleChange(
  facts: UserMutationFacts,
  nextRole: string
): UserMutationEvaluation {
  if (!canManageUsersRole(facts.actorRole)) return { ok: false, code: "FORBIDDEN" };
  if (!isAssignableRole(nextRole)) return { ok: false, code: "INVALID" };
  if (nextRole === facts.targetRole) return { ok: true };

  // Changing your own role is a self-lockout risk in both directions.
  if (facts.targetId === facts.actorId) return { ok: false, code: "SELF" };

  if (
    facts.targetRole === "ADMIN" &&
    nextRole !== "ADMIN" &&
    facts.activeAdminCount <= 1
  ) {
    return { ok: false, code: "LAST_ADMIN" };
  }
  return { ok: true };
}