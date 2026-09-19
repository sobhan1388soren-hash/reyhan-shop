// Data Access Layer — server-side authentication & user data access.
// All authorization flows through here; user identity is always derived
// from the signed session cookie, never from client-supplied IDs.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "./session";

export type CurrentUser = {
  id: string;
  phone: string;
  phoneVerified: boolean;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: Date;
};

/** Read the current user without redirecting. Null when logged out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
});

/** Require an authenticated customer — redirects to login otherwise. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return user;
});

/** Display name helper — Persian fallback. */
export function userDisplayName(user: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return "کاربر ریحان";
}
