// Unit tests — checkout server-side validation logic (pure functions).
// These run WITHOUT a database: they cover the provider-agnostic shipping
// and payment resolution, the discount placeholder, totals computation,
// and order-number generation. DB-dependent paths (address ownership,
// live cart re-validation, transactional order creation) are exercised by
// the same modules' server pipeline once PostgreSQL is provisioned.
//
// Run: npm run test:checkout   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import { getShippingMethods, resolveShippingMethod, calculateShippingCost } from "./shipping.ts";
import { getPaymentMethods, resolvePaymentMethod } from "./payment.ts";
import {
  normalizeDiscountCode,
  resolveSubmittedDiscountCode,
  DISCOUNT_STACK_MESSAGE,
} from "./discount.ts";
import { computeCheckoutTotals, generateOrderNumber } from "./totals.ts";

// ── Shipping — provider-agnostic placeholder ───────────────────────────

test("shipping: exactly one unspecified standard method exists", () => {
  const methods = getShippingMethods();
  assert.equal(methods.length, 1);
  assert.equal(methods[0].id, "STANDARD");
  assert.equal(methods[0].selectable, true);
  assert.equal(methods[0].cost, null, "no shipping price may be invented in Phase 9");
});

test("shipping: resolves only known, selectable method ids", () => {
  assert.equal(resolveShippingMethod("STANDARD").ok, true);
  assert.equal(resolveShippingMethod("EXPRESS").ok, false);
  assert.equal(resolveShippingMethod("").ok, false);
  assert.equal(resolveShippingMethod(null).ok, false);
  assert.equal(resolveShippingMethod(undefined).ok, false);
  assert.equal(resolveShippingMethod(42).ok, false);
  assert.equal(resolveShippingMethod("FREE_SHIPPING_HACK").ok, false);
});

test("shipping: placeholder cost is always 0 — no invented charge", () => {
  const method = getShippingMethods()[0];
  assert.equal(calculateShippingCost(method), 0);
});

// ── Payment — provider-agnostic, ONLINE only ───────────────────────────

test("payment: ONLINE is the only representable method", () => {
  const methods = getPaymentMethods();
  assert.equal(methods.length, 1);
  assert.equal(methods[0].id, "ONLINE");
  assert.equal(methods[0].selectable, true);
});

test("payment: rejects unknown/absent method ids", () => {
  assert.equal(resolvePaymentMethod("ONLINE").ok, true);
  assert.equal(resolvePaymentMethod("COD").ok, false, "COD is not approved in Phase 9");
  assert.equal(resolvePaymentMethod("CARD_TO_CARD").ok, false);
  assert.equal(resolvePaymentMethod("ZARINPAL").ok, false, "gateway ids are Phase 10");
  assert.equal(resolvePaymentMethod("").ok, false);
  assert.equal(resolvePaymentMethod(null).ok, false);
});

// ── Discount input handling (Phase 12 — full engine tests live in
//     src/lib/discounts/discounts.test.mjs) ─────────────────────────────

test("discount: submitted codes normalize through resolveSubmittedDiscountCode", () => {
  const result = resolveSubmittedDiscountCode(["  REYHAN10  "]);
  assert.equal(result.ok, true);
  assert.equal(result.code.present, true);
  assert.equal(result.code.code, "REYHAN10");
});

test("discount: empty/absent/hostile codes yield a silent no-op", () => {
  assert.equal(normalizeDiscountCode(""), "");
  assert.equal(normalizeDiscountCode(null), "");
  assert.equal(normalizeDiscountCode(undefined), "");
  assert.equal(normalizeDiscountCode(12345), "");
  assert.equal(normalizeDiscountCode({ malicious: true }), "");
  const none = resolveSubmittedDiscountCode([null, 42, "   "]);
  assert.equal(none.ok, true);
  assert.equal(none.code.present, false);
});

test("discount: stacking multiple codes is rejected with the Persian error", () => {
  const stacked = resolveSubmittedDiscountCode(["A10", "B20", "C30"]);
  assert.equal(stacked.ok, false);
  assert.equal(stacked.error, DISCOUNT_STACK_MESSAGE);
  // Whitespace-only or absent entries never trigger the stack rejection.
  const single = resolveSubmittedDiscountCode(["A10", "", "  "]);
  assert.equal(single.ok, true);
  assert.equal(single.code.code, "A10");
});

test("discount: codes are length-capped against hostile input", () => {
  const long = "X".repeat(500);
  const result = normalizeDiscountCode(long);
  assert.ok(result.length <= 64);
});

// ── Totals — server-side computation rules (never trust client math) ───

test("totals: subtotal + shipping − discount with floor clamps", () => {
  const cart = { subtotal: 1_000_000 };
  const t1 = computeCheckoutTotals({ cart, shippingMethodCost: 0, discountAmount: 0 });
  assert.deepEqual(t1, {
    subtotal: 1_000_000,
    shippingCost: 0,
    discountAmount: 0,
    totalAmount: 1_000_000,
  });

  // Negative shipping/discount can never exploit totals.
  const t2 = computeCheckoutTotals({ cart, shippingMethodCost: -50_000, discountAmount: -999 });
  assert.equal(t2.shippingCost, 0);
  assert.equal(t2.discountAmount, 0);
  assert.equal(t2.totalAmount, 1_000_000);

  // Discount can never exceed the subtotal.
  const t3 = computeCheckoutTotals({ cart, shippingMethodCost: 20_000, discountAmount: 2_000_000 });
  assert.equal(t3.discountAmount, 1_000_000);
  assert.equal(t3.totalAmount, 20_000);

  // Fractional costs are rounded deterministically.
  const t4 = computeCheckoutTotals({ cart, shippingMethodCost: 1000.7, discountAmount: 0 });
  assert.equal(t4.shippingCost, 1001);
  assert.equal(t4.totalAmount, 1_001_001);
});

test("totals: negative/zero subtotal can never produce a payable amount", () => {
  const t = computeCheckoutTotals({ cart: { subtotal: -5 }, shippingMethodCost: 30_000, discountAmount: 0 });
  assert.equal(t.subtotal, 0);
  assert.equal(t.totalAmount, 30_000); // subtotal floor 0 + shipping
});

test("totals: free shipping waives the shipping cost (Phase 12)", () => {
  const t = computeCheckoutTotals({
    cart: { subtotal: 1_000_000 },
    shippingMethodCost: 80_000,
    discountAmount: 0,
    freeShipping: true,
  });
  assert.deepEqual(t, {
    subtotal: 1_000_000,
    shippingCost: 0,
    discountAmount: 0,
    totalAmount: 1_000_000,
  });
});

// ── Order number ────────────────────────────────────────────────────────

test("order number: RY-YYYYMMDD-#### format, unique across calls", () => {
  const now = new Date(2026, 8, 12); // month is 0-based → 2026-09-12
  const n1 = generateOrderNumber(now);
  const n2 = generateOrderNumber(now);
  assert.match(n1, /^RY-20260912-\d{4}$/);
  assert.match(n2, /^RY-20260912-\d{4}$/);
  assert.notEqual(n1, n2, "random suffix must vary");
});
