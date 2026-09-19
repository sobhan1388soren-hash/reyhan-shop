// Unit tests — Phase 13 admin authorization (pure logic, DB-free).
// Covers deny-by-default access decisions (UNAUTHENTICATED / INACTIVE /
// NOT_ADMIN), role allow-lists, elevated ADMIN-only capabilities, and
// role-filtered admin navigation. The DAL (src/lib/admin/dal.ts) feeds
// these rules ONLY with the DATABASE user row — session role claims are
// never an authorization source.
//
// Run: npm run test:admin   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAdminAccess,
  isAdminCapableRole,
  canManageUsersRole,
  ADMIN_CAPABLE_ROLES,
  USER_MANAGEMENT_ROLES,
  ADMIN_ACCESS_MESSAGES,
  ADMIN_NAVIGATION,
  filterAdminNavForRole,
} from "./rules.ts";
import {
  parseAdminSearchTerm,
  parseEnumFilter,
  parseSortOption,
  parseAdminListPage,
  firstParam,
  ADMIN_PAGE_SIZE,
  ADMIN_SEARCH_MAX_LENGTH,
} from "./list.ts";
import {
  orderStatusTones,
  paymentStatusTones,
  userStatusLabels,
  userStatusTones,
  userRoleLabels,
  discountTypeLabel,
} from "./labels.ts";

// ── Role allow-lists ──────────────────────────────────────────────────

test("ADMIN and STAFF are admin-capable; CUSTOMER is not", () => {
  assert.equal(isAdminCapableRole("ADMIN"), true);
  assert.equal(isAdminCapableRole("STAFF"), true);
  assert.equal(isAdminCapableRole("CUSTOMER"), false);
});

test("unknown/forged role strings are denied (deny-by-default)", () => {
  for (const role of ["", "admin", "Admin", "SUPERADMIN", "ADMIN;DROP", "ROOT"]) {
    assert.equal(isAdminCapableRole(role), false, `role=${role}`);
    const access = evaluateAdminAccess({ role, status: "ACTIVE" });
    assert.equal(access.allowed, false);
    assert.equal(access.reason, "NOT_ADMIN");
  }
});

test("allow-lists contain exactly the expected roles", () => {
  assert.deepEqual([...ADMIN_CAPABLE_ROLES].sort(), ["ADMIN", "STAFF"]);
  assert.deepEqual([...USER_MANAGEMENT_ROLES], ["ADMIN"]);
});

// ── Access decisions ──────────────────────────────────────────────────

test("missing subject (no session / no DB row) → UNAUTHENTICATED", () => {
  const access = evaluateAdminAccess(null);
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "UNAUTHENTICATED");
});

test("non-ACTIVE status is denied even for ADMIN (BLOCKED/DELETED)", () => {
  for (const status of ["BLOCKED", "DELETED", "", "active"]) {
    const access = evaluateAdminAccess({ role: "ADMIN", status });
    assert.equal(access.allowed, false, `status=${status}`);
    assert.equal(access.reason, "INACTIVE");
  }
});

test("active CUSTOMER is denied with NOT_ADMIN", () => {
  const access = evaluateAdminAccess({ role: "CUSTOMER", status: "ACTIVE" });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "NOT_ADMIN");
});

test("active ADMIN and STAFF are allowed with their resolved role", () => {
  for (const role of ["ADMIN", "STAFF"]) {
    const access = evaluateAdminAccess({ role, status: "ACTIVE" });
    assert.equal(access.allowed, true);
    assert.equal(access.role, role);
  }
});

test("elevated capability: only ADMIN can manage users", () => {
  assert.equal(canManageUsersRole("ADMIN"), true);
  assert.equal(canManageUsersRole("STAFF"), false);
  assert.equal(canManageUsersRole("CUSTOMER"), false);
  assert.equal(canManageUsersRole("ADMIN-x"), false);
});

test("every denial reason has Persian copy", () => {
  for (const reason of ["UNAUTHENTICATED", "INACTIVE", "NOT_ADMIN"]) {
    assert.equal(typeof ADMIN_ACCESS_MESSAGES[reason], "string");
    assert.ok(ADMIN_ACCESS_MESSAGES[reason].length > 0);
  }
});

// ── Navigation filtering (role-scoped UI) ─────────────────────────────

test("CUSTOMER sees no admin navigation sections", () => {
  assert.deepEqual(filterAdminNavForRole(ADMIN_NAVIGATION, "CUSTOMER"), []);
  assert.deepEqual(filterAdminNavForRole(ADMIN_NAVIGATION, "SUPERADMIN"), []);
});

test("STAFF sees dashboard/store sections but not users/settings", () => {
  const sections = filterAdminNavForRole(ADMIN_NAVIGATION, "STAFF");
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin"));
  assert.ok(hrefs.includes("/admin/products"));
  assert.ok(!hrefs.includes("/admin/users"));
  assert.ok(!hrefs.includes("/admin/settings"));
});

test("ADMIN sees the elevated sections too", () => {
  const sections = filterAdminNavForRole(ADMIN_NAVIGATION, "ADMIN");
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/admin/users"));
  assert.ok(hrefs.includes("/admin/settings"));
});

test("dashboard entry is never marked disabled", () => {
  const sections = filterAdminNavForRole(ADMIN_NAVIGATION, "ADMIN");
  const dashboard = sections.flatMap((s) => s.items).find((i) => i.href === "/admin");
  assert.ok(dashboard);
  assert.notEqual(dashboard.disabled, true);
});

// ── DAL contract: authorization input is the DB row, not the session ──
//
// The DAL is server-only (prisma/cookies), so we pin its contract here:
// whatever getCurrentUser() yields (the DB user row shape) is the ONLY
// input to evaluateAdminAccess, and a stale/forged session role must not
// change the decision when the DB row disagrees.

test("decision follows the DB row even when it differs from session claims", () => {
  // Session claimed ADMIN, but the DB row (source of truth) says CUSTOMER.
  const dbRow = { role: "CUSTOMER", status: "ACTIVE" };
  const access = evaluateAdminAccess(dbRow);
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "NOT_ADMIN");

  // DB promoted the user to STAFF — decision flips only because the row did.
  assert.equal(evaluateAdminAccess({ role: "STAFF", status: "ACTIVE" }).allowed, true);
});

test("blocked admin is locked out regardless of any session token", () => {
  const dbRow = { role: "ADMIN", status: "BLOCKED" };
  assert.equal(evaluateAdminAccess(dbRow).allowed, false);
});

// ── Phase 14-A: navigation enablement ──────────────────────────────────

test("orders and users nav entries are live (not disabled) in 14-A", () => {
  const dashboardItems = (role) =>
    filterAdminNavForRole(ADMIN_NAVIGATION, role).flatMap((s) => s.items);
  const orders = dashboardItems("STAFF").find((i) => i.href === "/admin/orders");
  const users = dashboardItems("ADMIN").find((i) => i.href === "/admin/users");
  assert.ok(orders);
  assert.notEqual(orders.disabled, true);
  assert.ok(users);
  assert.notEqual(users.disabled, true);
});

test("only the settings placeholder stays disabled after Phase 14", () => {
  const staffHrefs = filterAdminNavForRole(ADMIN_NAVIGATION, "STAFF").flatMap((s) =>
    s.items.map((i) => i.href)
  );
  assert.ok(!staffHrefs.includes("/admin/users"));
  const adminItems = filterAdminNavForRole(ADMIN_NAVIGATION, "ADMIN").flatMap((s) => s.items);
  const settings = adminItems.find((i) => i.href === "/admin/settings");
  assert.ok(settings, "settings still listed");
  assert.equal(settings.disabled, true, "settings stays disabled until built");
});

// ── Phase 14: all built modules are live ───────────────────────────────

test("every completed Phase 14 module is live in the navigation", () => {
  const staffItems = filterAdminNavForRole(ADMIN_NAVIGATION, "STAFF").flatMap((s) => s.items);
  for (const href of [
    "/admin",
    "/admin/products",
    "/admin/categories",
    "/admin/orders",
    "/admin/discounts",
    "/admin/reviews",
    "/admin/questions",
  ]) {
    const item = staffItems.find((i) => i.href === href);
    assert.ok(item, `${href} present`);
    assert.notEqual(item.disabled, true, `${href} must be live`);
  }
});

// ── Phase 14-A: shared admin list input handling (pure) ────────────────

test("search terms are trimmed, collapsed, and hard-capped", () => {
  assert.equal(parseAdminSearchTerm("  RY-123  "), "RY-123");
  assert.equal(parseAdminSearchTerm("رضوی   خراسان"), "رضوی خراسان");
  assert.equal(parseAdminSearchTerm("   "), undefined);
  assert.equal(parseAdminSearchTerm(undefined), undefined);
  assert.equal(parseAdminSearchTerm("x".repeat(200)).length, ADMIN_SEARCH_MAX_LENGTH);
});

test("enum filters are whitelisted — forged values drop, valid ones pass", () => {
  const allowed = ["PENDING", "PAID", "FAILED"];
  assert.equal(parseEnumFilter("PAID", allowed), "PAID");
  assert.equal(parseEnumFilter("paid", allowed), undefined);
  assert.equal(parseEnumFilter("DROP TABLE", allowed), undefined);
  assert.equal(parseEnumFilter(undefined, allowed), undefined);
});

test("sort options fall back to the fixed default", () => {
  assert.equal(parseSortOption("newest", ["newest", "oldest"], "newest"), "newest");
  assert.equal(parseSortOption("evil", ["newest", "oldest"], "newest"), "newest");
});

test("admin pagination clamps page and keeps the fixed page size", () => {
  assert.equal(ADMIN_PAGE_SIZE, 20);
  const p = parseAdminListPage({ page: "3" });
  assert.deepEqual(
    { page: p.page, pageSize: p.pageSize, skip: p.skip, take: p.take },
    { page: 3, pageSize: 20, skip: 40, take: 20 }
  );
  assert.equal(parseAdminListPage({ page: "-1" }).page, 1);
  assert.equal(parseAdminListPage({ page: "abc" }).page, 1);
  assert.equal(parseAdminListPage({}).skip, 0);
});

test("firstParam takes the first value of repeated params", () => {
  assert.equal(firstParam(["a", "b"]), "a");
  assert.equal(firstParam("x"), "x");
  assert.equal(firstParam(undefined), undefined);
});

// ── Phase 14-A: status tones cover the real enums exactly ──────────────

test("order/payment tones are total over the schema enums (no invented states)", () => {
  const orderStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
  const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"];
  for (const s of orderStatuses) assert.ok(orderStatusTones[s], `tone for ${s}`);
  for (const s of paymentStatuses) assert.ok(paymentStatusTones[s], `tone for ${s}`);
  assert.deepEqual(Object.keys(orderStatusTones).sort(), orderStatuses.slice().sort());
  assert.deepEqual(Object.keys(paymentStatusTones).sort(), paymentStatuses.slice().sort());
});

test("user status/role labels are total and Persian", () => {
  for (const s of ["ACTIVE", "BLOCKED", "DELETED"]) assert.ok(userStatusLabels[s]?.length);
  for (const s of ["ACTIVE", "BLOCKED", "DELETED"]) assert.ok(userStatusTones[s]);
  for (const r of ["CUSTOMER", "ADMIN", "STAFF"]) assert.ok(userRoleLabels[r]?.length);
});

test("discount type snapshot labels: known enum strings map, junk returns null", () => {
  assert.equal(discountTypeLabel("PERCENTAGE"), "درصدی");
  assert.equal(discountTypeLabel("FREE_SHIPPING"), "ارسال رایگان");
  assert.equal(discountTypeLabel("SOMETHING_ELSE"), null);
  assert.equal(discountTypeLabel(null), null);
});
