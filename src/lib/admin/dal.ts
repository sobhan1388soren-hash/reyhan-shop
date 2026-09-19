// Admin Data Access Layer — Phase 13.
// Server-only. Authorization is ALWAYS resolved from the database user
// row via the existing auth DAL (getCurrentUser). Session role claims are
// never trusted for admin authorization; the deny-by-default decision
// lives in src/lib/admin/rules.ts.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { evaluateAdminAccess, type AdminAccess } from "./rules";

export type AdminUser = CurrentUser & { adminRole: "ADMIN" | "STAFF" };

/** Resolve admin access from the DB user row. Never throws. */
export const getAdminAccess = cache(
  async (): Promise<{ user: AdminUser | null; access: AdminAccess }> => {
    const dbUser = await getCurrentUser(); // DB-backed, session-derived
    const access = evaluateAdminAccess(dbUser);
    if (!dbUser || !access.allowed) return { user: null, access };
    return { user: { ...dbUser, adminRole: access.role }, access };
  }
);

/**
 * Require an admin-capable user for admin pages/actions.
 * - No session / no active DB row → login (returns to /admin after).
 * - Active customer without admin role → away to their account.
 * Layout-level and action-level enforcement; the proxy check in
 * src/proxy.ts is only an optimistic first filter.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  const { user, access } = await getAdminAccess();
  if (!user) {
    redirect(
      access.allowed === false && access.reason === "UNAUTHENTICATED"
        ? "/login?next=/admin"
        : "/account"
    );
  }
  return user;
});

/** Server-side gate for admin actions: returns the actor or redirects. */
export async function requireAdminForAction(): Promise<AdminUser> {
  return requireAdmin();
}

/** Lightweight boolean check for conditional UI (sidebar sections etc.). */
export const isAdminSession = cache(async (): Promise<boolean> => {
  const { access } = await getAdminAccess();
  return access.allowed;
});
