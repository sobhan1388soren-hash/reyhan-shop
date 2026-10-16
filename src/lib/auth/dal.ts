// Data Access Layer — server-side authentication & user data access.
// All authorization flows through here; user identity is always derived
// from the signed session cookie, never from client-supplied IDs.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "./session";
import type { CurrentUser } from "./user-display";

// `CurrentUser`, `userDisplayName` and `userContactLabel` are pure and have no
// server-only dependency, so they live in ./user-display and are re-exported
// here. Client Components must import them from ./user-display directly —
// importing them from this module drags `server-only`/`next/headers` across the
// client boundary and fails the build.
export type { CurrentUser, UserContactSource, UserDisplayNameSource } from "./user-display";
export { userContactLabel, userDisplayName } from "./user-display";

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
        nationalCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        passwordHash: true,
      },
    });
    if (!user || user.status !== "ACTIVE") return null;
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: Boolean(passwordHash) };
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
