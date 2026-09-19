// Unit tests — Phase 14 Part 2 customer/user administration rules (pure).
// Covers ADMIN-only authorization, enum validation, and the self / last-admin
// integrity guards.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNABLE_ROLES,
  MANAGEABLE_STATUSES,
  isAssignableRole,
  isManageableStatus,
  evaluateUserStatusChange,
  evaluateUserRoleChange,
  USER_ADMIN_MESSAGES,
} from "./user-admin-rules.ts";

const base = {
  actorId: "admin-1",
  actorRole: "ADMIN",
  targetId: "user-9",
  targetRole: "CUSTOMER",
  targetStatus: "ACTIVE",
  activeAdminCount: 2,
};

test("only real schema enum values are assignable/manageable", () => {
  assert.deepEqual([...ASSIGNABLE_ROLES], ["CUSTOMER", "ADMIN", "STAFF"]);
  assert.deepEqual([...MANAGEABLE_STATUSES], ["ACTIVE", "BLOCKED"]);
  assert.equal(isAssignableRole("ADMIN"), true);
  assert.equal(isAssignableRole("SUPERADMIN"), false);
  assert.equal(isAssignableRole("USER"), false);
  assert.equal(isManageableStatus("BLOCKED"), true);
  assert.equal(isManageableStatus("DELETED"), false);
});

test("status change: STAFF and CUSTOMER are forbidden (ADMIN-only)", () => {
  for (const role of ["STAFF", "CUSTOMER", "", "SUPERADMIN"]) {
    const result = evaluateUserStatusChange({ ...base, actorRole: role }, "BLOCKED");
    assert.equal(result.ok, false, role);
    assert.equal(result.code, "FORBIDDEN");
  }
});

test("status change: ADMIN can block and unblock", () => {
  const block = evaluateUserStatusChange(base, "BLOCKED");
  assert.deepEqual(block, { ok: true });
  const unblock = evaluateUserStatusChange({ ...base, targetStatus: "BLOCKED" }, "ACTIVE");
  assert.deepEqual(unblock, { ok: true });
});

test("status change: invalid / destructive statuses rejected", () => {
  assert.deepEqual(evaluateUserStatusChange(base, "DELETED"), { ok: false, code: "INVALID" });
  assert.deepEqual(evaluateUserStatusChange(base, "WHATEVER"), { ok: false, code: "INVALID" });
});

test("status change: an admin cannot block their own account", () => {
  const result = evaluateUserStatusChange({ ...base, targetId: "admin-1" }, "BLOCKED");
  assert.deepEqual(result, { ok: false, code: "SELF" });
});

test("status change: the last active admin cannot be blocked", () => {
  const result = evaluateUserStatusChange(
    { ...base, targetRole: "ADMIN", activeAdminCount: 1 },
    "BLOCKED"
  );
  assert.deepEqual(result, { ok: false, code: "LAST_ADMIN" });
});

test("role change: STAFF forbidden; ADMIN may change roles", () => {
  assert.deepEqual(evaluateUserRoleChange({ ...base, actorRole: "STAFF" }, "STAFF"), {
    ok: false,
    code: "FORBIDDEN",
  });
  assert.deepEqual(evaluateUserRoleChange(base, "STAFF"), { ok: true });
  assert.deepEqual(evaluateUserRoleChange(base, "ADMIN"), { ok: true });
});

test("role change: forged role values rejected", () => {
  assert.deepEqual(evaluateUserRoleChange(base, "OWNER"), { ok: false, code: "INVALID" });
  assert.deepEqual(evaluateUserRoleChange(base, "user"), { ok: false, code: "INVALID" });
});

test("role change: changing your own role is refused", () => {
  const result = evaluateUserRoleChange({ ...base, targetId: "admin-1" }, "STAFF");
  assert.deepEqual(result, { ok: false, code: "SELF" });
});

test("role change: the last active admin cannot be demoted", () => {
  const result = evaluateUserRoleChange(
    { ...base, targetRole: "ADMIN", activeAdminCount: 1 },
    "STAFF"
  );
  assert.deepEqual(result, { ok: false, code: "LAST_ADMIN" });
});

test("no-op mutations are allowed without side effects", () => {
  assert.deepEqual(evaluateUserStatusChange(base, "ACTIVE"), { ok: true });
  assert.deepEqual(evaluateUserRoleChange(base, "CUSTOMER"), { ok: true });
});

test("every user admin error code has Persian copy", () => {
  for (const code of ["FORBIDDEN", "INVALID", "SELF", "LAST_ADMIN", "NOT_FOUND", "DB_ERROR"]) {
    assert.ok(USER_ADMIN_MESSAGES[code]?.length > 0, code);
  }
});