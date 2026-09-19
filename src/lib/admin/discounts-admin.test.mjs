// Unit tests — Phase 14 Part 2 discount administration rules (pure).
// Validation/normalization only — the discount calculation/eligibility
// engine itself is covered by the existing discounts suite.

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDiscountAdminInput,
  derivedDiscountStatus,
  isDiscountType,
  DISCOUNT_ADMIN_MESSAGES,
  MAX_DISCOUNT_TOMAN,
} from "./discount-admin-rules.ts";

const valid = {
  code: "REYHAN10",
  type: "PERCENTAGE",
  value: "10",
  minOrderAmount: "",
  maxDiscountAmount: "",
  maxUses: "",
  maxUsesPerUser: "",
  startsAt: "",
  endsAt: "",
  isActive: "true",
};

test("percentage discount validates and normalizes", () => {
  const result = validateDiscountAdminInput(valid);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.type, "PERCENTAGE");
    assert.equal(result.data.value, 10);
    assert.equal(result.data.minOrderAmount, null);
    assert.equal(result.data.isActive, true);
  }
});

test("fixed amount is entered in Toman and stored in Rial", () => {
  const result = validateDiscountAdminInput({ ...valid, type: "FIXED_AMOUNT", value: "50000" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.value, 500_000);
});

test("free shipping has no monetary value", () => {
  const result = validateDiscountAdminInput({ ...valid, type: "FREE_SHIPPING", value: "999" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.value, 0);
});

test("invalid type and out-of-range values are rejected", () => {
  assert.equal(validateDiscountAdminInput({ ...valid, type: "BOGUS" }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, value: "0" }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, value: "101" }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, value: "abc" }).ok, false);
  assert.equal(
    validateDiscountAdminInput({ ...valid, type: "FIXED_AMOUNT", value: "0" }).ok,
    false
  );
});

test("code is required and length-capped", () => {
  assert.equal(validateDiscountAdminInput({ ...valid, code: "   " }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, code: "x".repeat(65) }).ok, false);
});

test("optional money limits validate (Toman → Rial)", () => {
  const ok = validateDiscountAdminInput({ ...valid, minOrderAmount: "100000" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.minOrderAmount, 1_000_000);
  assert.equal(validateDiscountAdminInput({ ...valid, minOrderAmount: "-1" }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, maxDiscountAmount: "abc" }).ok, false);
});

test("usage limits must be positive integers when provided", () => {
  const ok = validateDiscountAdminInput({ ...valid, maxUses: "100", maxUsesPerUser: "1" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.maxUses, 100);
    assert.equal(ok.data.maxUsesPerUser, 1);
  }
  assert.equal(validateDiscountAdminInput({ ...valid, maxUses: "0" }).ok, false);
  assert.equal(validateDiscountAdminInput({ ...valid, maxUsesPerUser: "x" }).ok, false);
});

test("validity window must be ordered", () => {
  const ok = validateDiscountAdminInput({
    ...valid,
    startsAt: "2026-01-01",
    endsAt: "2026-02-01",
  });
  assert.equal(ok.ok, true);
  const bad = validateDiscountAdminInput({
    ...valid,
    startsAt: "2026-02-01",
    endsAt: "2026-01-01",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.endsAt);
});

test("value cap keeps stored Rial within range", () => {
  const over = validateDiscountAdminInput({
    ...valid,
    type: "FIXED_AMOUNT",
    value: String(MAX_DISCOUNT_TOMAN + 1),
  });
  assert.equal(over.ok, false);
});

test("display status is derived from active + window", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal(
    derivedDiscountStatus({ isActive: false, startsAt: null, endsAt: null, now }),
    "INACTIVE"
  );
  assert.equal(
    derivedDiscountStatus({
      isActive: true,
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: null,
      now,
    }),
    "SCHEDULED"
  );
  assert.equal(
    derivedDiscountStatus({
      isActive: true,
      startsAt: null,
      endsAt: new Date("2026-05-01T00:00:00Z"),
      now,
    }),
    "EXPIRED"
  );
  assert.equal(
    derivedDiscountStatus({ isActive: true, startsAt: null, endsAt: null, now }),
    "ACTIVE"
  );
});

test("isDiscountType accepts exactly the schema enum", () => {
  assert.equal(isDiscountType("PERCENTAGE"), true);
  assert.equal(isDiscountType("FIXED_AMOUNT"), true);
  assert.equal(isDiscountType("FREE_SHIPPING"), true);
  assert.equal(isDiscountType("BUY_ONE"), false);
});

test("every discount admin error code has Persian copy", () => {
  for (const code of ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "DUPLICATE_CODE", "DB_ERROR"]) {
    assert.ok(DISCOUNT_ADMIN_MESSAGES[code]?.length > 0, code);
  }
});