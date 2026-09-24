// Security regression tests — Phase 18 audit.
//
// Covers ONLY confirmed findings with pure, DB-free assertions
// (node --test with TS type-stripping). Server-only behavior
// (auth/session.ts fail-closed parsing, auth/sms.ts production refusal,
// admin/dal.ts requireUserManager redirect) delegates to the pure helpers
// tested here, so these tests guard the decisions even though the
// server-only adapters cannot be imported in a bare node process.
//
// Run: npm run test:security

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSessionSecret,
  isConsoleSmsDeliveryAllowed,
  DEV_SESSION_SECRET,
} from "./guards.ts";
import {
  evaluateAdminAccess,
  canManageUsersRole,
  isAdminCapableRole,
} from "../admin/rules.ts";

// ── Finding 1 (HIGH): SESSION_SECRET dev fallback must never sign in prod ──

test("session secret: strong secret is accepted in any environment", () => {
  const secret = "a".repeat(32);
  for (const env of ["development", "test", "production"]) {
    const resolved = resolveSessionSecret({ SESSION_SECRET: secret, NODE_ENV: env });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.secret, secret);
    assert.equal(resolved.devFallback, false);
  }
});

test("session secret: short secrets are rejected in production", () => {
  for (const bad of [undefined, "", "short", "x".repeat(31)]) {
    const resolved = resolveSessionSecret({ SESSION_SECRET: bad, NODE_ENV: "production" });
    assert.equal(resolved.ok, false, `secret=${JSON.stringify(bad)}`);
  }
});

test("session secret: missing secret falls back ONLY outside production", () => {
  const dev = resolveSessionSecret({ NODE_ENV: "development" });
  assert.equal(dev.ok, true);
  assert.equal(dev.devFallback, true);
  assert.equal(dev.secret, DEV_SESSION_SECRET);

  const prod = resolveSessionSecret({ NODE_ENV: "production" });
  assert.equal(prod.ok, false);
});

test("session secret: dev fallback value is the known public constant", () => {
  // The fallback is public (in-repo), which is exactly why production
  // must refuse it — anyone holding it could forge session cookies.
  assert.ok(DEV_SESSION_SECRET.length >= 32);
});

// ── Finding 2 (MED): console SMS sender must fail closed in production ──

test("sms: console delivery is refused in production, allowed elsewhere", () => {
  assert.equal(isConsoleSmsDeliveryAllowed({ NODE_ENV: "production" }), false);
  assert.equal(isConsoleSmsDeliveryAllowed({ NODE_ENV: "development" }), true);
  assert.equal(isConsoleSmsDeliveryAllowed({ NODE_ENV: "test" }), true);
  assert.equal(isConsoleSmsDeliveryAllowed({}), true);
});

// ── Finding 3 (MED): /admin/users is ADMIN-only — STAFF reads denied ──

test("users gate: STAFF is admin-capable but NOT a user manager", () => {
  assert.equal(isAdminCapableRole("STAFF"), true);
  assert.equal(canManageUsersRole("STAFF"), false);
  assert.equal(canManageUsersRole("ADMIN"), true);
  assert.equal(canManageUsersRole("CUSTOMER"), false);
});

test("users gate: STAFF passes admin entry but fails the users capability", () => {
  // requireUserManager() = requireAdmin() + canManageUsersRole(). The page
  // redirects STAFF to /admin because of this second check.
  const staffAccess = evaluateAdminAccess({ role: "STAFF", status: "ACTIVE" });
  assert.equal(staffAccess.allowed, true); // enters /admin layout …
  assert.equal(canManageUsersRole("STAFF"), false); // … but not /admin/users
});

test("users gate: forged/unknown roles never gain user management", () => {
  for (const role of ["admin", "ADMIN ", "SUPERADMIN", "", "USER", "STAFF,ADMIN"]) {
    assert.equal(canManageUsersRole(role), false, `role=${JSON.stringify(role)}`);
    assert.equal(isAdminCapableRole(role), false, `role=${JSON.stringify(role)}`);
  }
});

test("users gate: inactive ADMIN cannot manage users either", () => {
  const access = evaluateAdminAccess({ role: "ADMIN", status: "BLOCKED" });
  assert.equal(access.allowed, false);
});
