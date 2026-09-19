// Pure admin authorization rules — Phase 13.
// No DB, no cookies, no next/headers: fully unit-testable.
// Deny-by-default: access is granted only to an explicit allow-list of
// roles resolved from the DATABASE user row (see src/lib/admin/dal.ts).
// Session role claims are never consulted here.

export type AdminSubject = {
  role: string;
  status: string;
} | null;

export type AdminDenialReason = "UNAUTHENTICATED" | "INACTIVE" | "NOT_ADMIN";

export type AdminAccess =
  | { allowed: true; role: "ADMIN" | "STAFF" }
  | { allowed: false; reason: AdminDenialReason };

// The only roles that may enter the admin console. Anything else —
// including unknown/future role strings — is denied.
export const ADMIN_CAPABLE_ROLES = ["ADMIN", "STAFF"] as const;
export type AdminCapableRole = (typeof ADMIN_CAPABLE_ROLES)[number];

// Elevated capability (user management, settings): ADMIN only.
export const USER_MANAGEMENT_ROLES = ["ADMIN"] as const;

export const ACTIVE_STATUS = "ACTIVE";

/** True only for an exact, allow-listed admin-capable role string. */
export function isAdminCapableRole(role: string): role is AdminCapableRole {
  return (ADMIN_CAPABLE_ROLES as readonly string[]).includes(role);
}

/** Elevated admin capability check (deny-by-default on unknown roles). */
export function canManageUsersRole(role: string): boolean {
  return (USER_MANAGEMENT_ROLES as readonly string[]).includes(role);
}

/**
 * Decide admin-console access from the database user row only.
 * `null` (no session user) → UNAUTHENTICATED.
 * Non-ACTIVE status (BLOCKED/DELETED) → INACTIVE, even for ADMIN roles.
 * Any role outside the allow-list → NOT_ADMIN.
 */
export function evaluateAdminAccess(subject: AdminSubject): AdminAccess {
  if (!subject) return { allowed: false, reason: "UNAUTHENTICATED" };
  if (subject.status !== ACTIVE_STATUS) return { allowed: false, reason: "INACTIVE" };
  if (!isAdminCapableRole(subject.role)) return { allowed: false, reason: "NOT_ADMIN" };
  return { allowed: true, role: subject.role };
}

/** Persian copy for admin access denials (never leaks role internals). */
export const ADMIN_ACCESS_MESSAGES: Record<AdminDenialReason, string> = {
  UNAUTHENTICATED: "برای ورود به پنل مدیریت، ابتدا وارد حساب کاربری خود شوید.",
  INACTIVE: "حساب کاربری شما امکان دسترسی به پنل مدیریت را ندارد.",
  NOT_ADMIN: "حساب شما به پنل مدیریت دسترسی ندارد.",
};

// ── Admin navigation (single source; role-filtered server-side) ───────

export type AdminNavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "box"
    | "bag"
    | "users"
    | "tag"
    | "star"
    | "settings"
    | "sitemap"
    | "chat"
    | "article";
  /** Roles allowed to see this item. Omitted → any admin-capable role. */
  roles?: readonly string[];
  /** Placeholder modules (Phase 14) render non-interactive. */
  disabled?: boolean;
};

export type AdminNavSection = {
  label?: string;
  items: AdminNavItem[];
};

export const ADMIN_NAVIGATION: AdminNavSection[] = [
  {
    items: [{ label: "داشبورد", href: "/admin", icon: "dashboard" }],
  },
  {
    label: "فروشگاه",
    items: [
      { label: "محصولات", href: "/admin/products", icon: "box" },
      { label: "دسته‌بندی‌ها", href: "/admin/categories", icon: "sitemap" },
      { label: "سفارش‌ها", href: "/admin/orders", icon: "bag" },
      { label: "تخفیف‌ها", href: "/admin/discounts", icon: "tag" },
      { label: "نقد و بررسی‌ها", href: "/admin/reviews", icon: "star" },
      { label: "پرسش و پاسخ", href: "/admin/questions", icon: "chat" },
    ],
  },
  {
    label: "مدیریت",
    items: [
      // Elevated sections: ADMIN only (deny-by-default for STAFF).
      // Phase 14-A: users section is READ-ONLY inspection (no mutations).
      { label: "کاربران", href: "/admin/users", icon: "users", roles: USER_MANAGEMENT_ROLES },
      { label: "تنظیمات", href: "/admin/settings", icon: "settings", roles: USER_MANAGEMENT_ROLES, disabled: true },
    ],
  },
  {
    label: "محتوا",
    items: [
      { label: "مقالات", href: "/admin/blog/posts", icon: "article" },
      { label: "دسته‌بندی مقالات", href: "/admin/blog/categories", icon: "sitemap" },
    ],
  },
];

/**
 * Filter the admin navigation for a role. Deny-by-default:
 * non-admin roles see nothing; unknown sections/items with role lists the
 * subject does not hold are dropped.
 */
export function filterAdminNavForRole(
  sections: AdminNavSection[],
  role: string
): AdminNavSection[] {
  if (!isAdminCapableRole(role)) return [];
  const out: AdminNavSection[] = [];
  for (const section of sections) {
    const items = section.items.filter(
      (item) => !item.roles || item.roles.includes(role)
    );
    if (items.length > 0) out.push({ ...section, items });
  }
  return out;
}
