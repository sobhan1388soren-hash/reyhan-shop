// User display shape + pure presentation helpers.
//
// Deliberately free of `server-only`, `next/headers`, Prisma and any DB import
// so it is safe to import from Client Components. The session-aware queries stay
// in the server-only `./dal.ts`, which re-exports everything here so existing
// server-side imports keep working unchanged.

export type CurrentUser = {
  id: string;
  /** Null for accounts created via email/password (no phone on file yet). */
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  nationalCode: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: Date;
  /** True when the account has an email/password credential (never the hash). */
  hasPassword: boolean;
};

/** The subset needed to render a display name. */
export type UserDisplayNameSource = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** The subset needed to render a contact handle. */
export type UserContactSource = {
  phone: string | null;
  email: string | null;
};

/** Display name helper — Persian fallback. */
export function userDisplayName(user: UserDisplayNameSource): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return "کاربر ریحان";
}

/**
 * Best available contact handle for display — email-only accounts have no
 * phone. Never returns null so callers can render it unconditionally.
 */
export function userContactLabel(user: UserContactSource): string {
  if (user.phone) return user.phone;
  if (user.email) return user.email;
  return "—";
}
