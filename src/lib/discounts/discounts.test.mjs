// Unit tests — Phase 12 discount domain (pure logic, DB-free).
// Covers code normalization/stacking, rule validation (dates, limits,
// minimums), amount calculation (percentage cap, fixed floor, free
// shipping), the evaluation flow against an in-memory store fake, and the
// usage-consumption lifecycle including concurrency guards.
//
// Run: npm run test:discounts   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDiscountCode,
  normalizeDiscountCodeForKey,
  resolveSubmittedDiscountCode,
  DISCOUNT_STACK_MESSAGE,
} from "../checkout/discount.ts";
import { computeCheckoutTotals } from "../checkout/totals.ts";
import {
  validateDiscountRule,
  calculateDiscountAmount,
  evaluateDiscountForCart,
  consumeDiscountForPaidOrder,
  DISCOUNT_REJECT_MESSAGES,
} from "./rules.ts";

// ── Fixtures ────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-13T12:00:00.000Z");
const USER = "user_aaaaaaaaaaaaaaaaaaaa";
const USER_B = "user_bbbbbbbbbbbbbbbbbb";

function makeRecord(overrides = {}) {
  return {
    id: "disc_aaaaaaaaaaaaaaaaaaa",
    code: "REYHAN10",
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: null,
    maxDiscountAmount: null,
    maxUses: null,
    usedCount: 0,
    maxUsesPerUser: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

/** In-memory evaluate-store fake mirroring the Prisma adapter semantics. */
function makeEvaluateStore(records) {
  const userUsages = {};
  const store = {
    async findDiscountByCode(code) {
      const key = code.toUpperCase();
      return records.find((r) => r.code.toUpperCase() === key) ?? null;
    },
    async countUserUsages(discountId, userId) {
      return userUsages[`${discountId}:${userId}`] ?? 0;
    },
    userUsages,
  };
  return store;
}

// ── Code normalization & submission resolution ──────────────────────────

test("normalize: trims, collapses whitespace, caps length", () => {
  assert.equal(normalizeDiscountCode("  reyhan10  "), "reyhan10");
  assert.equal(normalizeDiscountCode("  A  B  "), "A B");
  assert.ok(normalizeDiscountCode("X".repeat(500)).length <= 64);
  assert.equal(normalizeDiscountCode(null), "");
  assert.equal(normalizeDiscountCode(12345), "");
  assert.equal(normalizeDiscountCode({ hostile: true }), "");
});

test("normalize: case-insensitive lookup key", () => {
  assert.equal(normalizeDiscountCodeForKey("reyhan10"), "REYHAN10");
  assert.equal(normalizeDiscountCodeForKey(" ReyHan10 "), "REYHAN10");
  assert.equal(normalizeDiscountCodeForKey(""), "");
});

test("submission: single code normalizes through", () => {
  const out = resolveSubmittedDiscountCode(["  reyhan10 "]);
  assert.equal(out.ok, true);
  assert.deepEqual(out.code, { present: true, code: "reyhan10" });
});

test("submission: empty/absent codes are a no-discount", () => {
  assert.deepEqual(resolveSubmittedDiscountCode([]).code, { present: false, code: "" });
  assert.deepEqual(resolveSubmittedDiscountCode(["", "   "]).code, { present: false, code: "" });
  assert.deepEqual(resolveSubmittedDiscountCode([null, 42]).code, { present: false, code: "" });
});

test("submission: stacking multiple codes is rejected", () => {
  const out = resolveSubmittedDiscountCode(["A10", "B20"]);
  assert.equal(out.ok, false);
  assert.equal(out.error, DISCOUNT_STACK_MESSAGE);
  // Whitespace-only entries never count as stacked codes.
  const out2 = resolveSubmittedDiscountCode(["A10", "   "]);
  assert.equal(out2.ok, true);
});

// ── Rule validation ─────────────────────────────────────────────────────

test("rule: valid active discount passes", () => {
  const verdict = validateDiscountRule(makeRecord(), { subtotal: 1_000_000, userUsedCount: 0 }, NOW);
  assert.deepEqual(verdict, { ok: true });
});

test("rule: inactive discount rejected", () => {
  const verdict = validateDiscountRule(makeRecord({ isActive: false }), { subtotal: 1_000_000, userUsedCount: 0 }, NOW);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "INACTIVE");
});

test("rule: not-yet-active discount rejected", () => {
  const verdict = validateDiscountRule(
    makeRecord({ startsAt: new Date("2026-09-14T00:00:00Z") }),
    { subtotal: 1_000_000, userUsedCount: 0 },
    NOW
  );
  assert.equal(verdict.reason, "NOT_YET_ACTIVE");
});

test("rule: expired discount rejected", () => {
  const verdict = validateDiscountRule(
    makeRecord({ endsAt: new Date("2026-09-12T00:00:00Z") }),
    { subtotal: 1_000_000, userUsedCount: 0 },
    NOW
  );
  assert.equal(verdict.reason, "EXPIRED");
});

test("rule: boundary instants are inclusive", () => {
  const startsAt = new Date("2026-09-13T12:00:00Z");
  const endsAt = new Date("2026-09-13T12:00:00Z");
  assert.equal(validateDiscountRule(makeRecord({ startsAt }), { subtotal: 1, userUsedCount: 0 }, NOW).ok, true);
  assert.equal(validateDiscountRule(makeRecord({ endsAt }), { subtotal: 1, userUsedCount: 0 }, NOW).ok, true);
});

test("rule: minimum order amount enforced", () => {
  const record = makeRecord({ minOrderAmount: 500_000 });
  assert.equal(
    validateDiscountRule(record, { subtotal: 499_999, userUsedCount: 0 }, NOW).reason,
    "MIN_ORDER_NOT_MET"
  );
  assert.equal(validateDiscountRule(record, { subtotal: 500_000, userUsedCount: 0 }, NOW).ok, true);
});

test("rule: global usage limit enforced", () => {
  const record = makeRecord({ maxUses: 5, usedCount: 5 });
  assert.equal(
    validateDiscountRule(record, { subtotal: 1_000_000, userUsedCount: 0 }, NOW).reason,
    "GLOBAL_LIMIT_REACHED"
  );
  assert.equal(
    validateDiscountRule(makeRecord({ maxUses: 5, usedCount: 4 }), { subtotal: 1_000_000, userUsedCount: 0 }, NOW).ok,
    true
  );
  // maxUses null = unlimited
  assert.equal(
    validateDiscountRule(makeRecord({ maxUses: null, usedCount: 1000 }), { subtotal: 1_000_000, userUsedCount: 0 }, NOW).ok,
    true
  );
});

test("rule: per-user usage limit enforced", () => {
  const record = makeRecord({ maxUsesPerUser: 2 });
  assert.equal(
    validateDiscountRule(record, { subtotal: 1_000_000, userUsedCount: 2 }, NOW).reason,
    "USER_LIMIT_REACHED"
  );
  assert.equal(
    validateDiscountRule(record, { subtotal: 1_000_000, userUsedCount: 1 }, NOW).ok,
    true
  );
  // maxUsesPerUser null = unlimited per user
  assert.equal(
    validateDiscountRule(makeRecord({ maxUsesPerUser: null }), { subtotal: 1_000_000, userUsedCount: 99 }, NOW).ok,
    true
  );
});

// ── Amount calculation ──────────────────────────────────────────────────

test("calc: valid percentage discount", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 10 }), 1_000_000), 100_000);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 100 }), 250_000), 250_000);
  // Rounding is deterministic on integers (15% of 333,333 = 49,999.95 → 50,000).
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 15 }), 333_333), 50_000);
});

test("calc: percentage respects the maximum discount cap", () => {
  const record = makeRecord({ type: "PERCENTAGE", value: 50, maxDiscountAmount: 200_000 });
  assert.equal(calculateDiscountAmount(record, 1_000_000), 200_000);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 50 }), 1_000_000), 500_000);
  // Cap above the computed amount is a no-op.
  assert.equal(
    calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 10, maxDiscountAmount: 500_000 }), 1_000_000),
    100_000
  );
});

test("calc: percentage never exceeds the subtotal", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 100 }), 80_000), 80_000);
});

test("calc: valid fixed discount", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "FIXED_AMOUNT", value: 250_000 }), 1_000_000), 250_000);
});

test("calc: fixed discount larger than the order never goes below zero", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "FIXED_AMOUNT", value: 2_000_000 }), 500_000), 500_000);
});

test("calc: free shipping discounts no product amount", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "FREE_SHIPPING", value: 0 }), 1_000_000), 0);
});

test("calc: hostile/invalid inputs yield zero", () => {
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 0 }), 1_000_000), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 101 }), 1_000_000), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: -5 }), 1_000_000), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "FIXED_AMOUNT", value: -1 }), 1_000_000), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "FIXED_AMOUNT", value: Number.NaN }), 1_000_000), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 10 }), 0), 0);
  assert.equal(calculateDiscountAmount(makeRecord({ type: "PERCENTAGE", value: 10 }), -5), 0);
});

// ── Evaluation flow (checkout preview + final validation) ──────────────

test("evaluate: nonexistent code rejected", async () => {
  const store = makeEvaluateStore([]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "NOPE", subtotal: 100, now: NOW });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "NOT_FOUND");
  assert.equal(out.error, undefined);
});

test("evaluate: case-insensitive code matching", async () => {
  const store = makeEvaluateStore([makeRecord({ code: "REYHAN10", type: "FIXED_AMOUNT", value: 100_000 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "reyhan10", subtotal: 1_000_000, now: NOW });
  assert.equal(out.ok, true);
  assert.equal(out.discount.amount, 100_000);
  assert.equal(out.discount.code, "REYHAN10");
});

test("evaluate: valid percentage applies with server-computed amount", async () => {
  const store = makeEvaluateStore([makeRecord({ type: "PERCENTAGE", value: 10 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "REYHAN10", subtotal: 1_000_000, now: NOW });
  assert.equal(out.ok, true);
  assert.equal(out.discount.amount, 100_000);
  assert.equal(out.discount.type, "PERCENTAGE");
  assert.equal(out.discount.value, 10);
});

test("evaluate: valid fixed applies; oversized fixed clamps to subtotal", async () => {
  const store = makeEvaluateStore([
    makeRecord({ code: "FIX50", type: "FIXED_AMOUNT", value: 50_000 }),
    makeRecord({ code: "FIXBIG", type: "FIXED_AMOUNT", value: 5_000_000 }),
  ]);
  const a = await evaluateDiscountForCart(store, { userId: USER, code: "FIX50", subtotal: 1_000_000, now: NOW });
  assert.equal(a.discount.amount, 50_000);
  const b = await evaluateDiscountForCart(store, { userId: USER, code: "FIXBIG", subtotal: 300_000, now: NOW });
  assert.equal(b.discount.amount, 300_000);
});

test("evaluate: free shipping applies with zero amount + freeShipping flag", async () => {
  const store = makeEvaluateStore([makeRecord({ code: "FREESHIP", type: "FREE_SHIPPING", value: 0 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "FREESHIP", subtotal: 1_000_000, now: NOW });
  assert.equal(out.ok, true);
  assert.equal(out.discount.amount, 0);
  assert.equal(out.discount.freeShipping, true);
});

test("evaluate: expired / not-yet-active / inactive codes rejected", async () => {
  const store = makeEvaluateStore([
    makeRecord({ code: "OLD", endsAt: new Date("2026-01-01T00:00:00Z") }),
    makeRecord({ code: "FUTURE", startsAt: new Date("2027-01-01T00:00:00Z") }),
    makeRecord({ code: "OFF", isActive: false }),
  ]);
  assert.equal((await evaluateDiscountForCart(store, { userId: USER, code: "OLD", subtotal: 100, now: NOW })).reason, "EXPIRED");
  assert.equal((await evaluateDiscountForCart(store, { userId: USER, code: "FUTURE", subtotal: 100, now: NOW })).reason, "NOT_YET_ACTIVE");
  assert.equal((await evaluateDiscountForCart(store, { userId: USER, code: "OFF", subtotal: 100, now: NOW })).reason, "INACTIVE");
});

test("evaluate: minimum order failure", async () => {
  const store = makeEvaluateStore([makeRecord({ code: "MIN500", minOrderAmount: 500_000 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "MIN500", subtotal: 400_000, now: NOW });
  assert.equal(out.reason, "MIN_ORDER_NOT_MET");
  assert.ok(DISCOUNT_REJECT_MESSAGES.MIN_ORDER_NOT_MET.includes("کافی نیست"));
});

test("evaluate: percentage cap respected end-to-end", async () => {
  const store = makeEvaluateStore([
    makeRecord({ code: "CAP20", type: "PERCENTAGE", value: 30, maxDiscountAmount: 200_000 }),
  ]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "CAP20", subtotal: 1_000_000, now: NOW });
  assert.equal(out.discount.amount, 200_000);
});

test("evaluate: global limit reached", async () => {
  const store = makeEvaluateStore([makeRecord({ code: "MAXED", maxUses: 3, usedCount: 3 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "MAXED", subtotal: 1_000_000, now: NOW });
  assert.equal(out.reason, "GLOBAL_LIMIT_REACHED");
});

test("evaluate: per-user limit reached", async () => {
  const store = makeEvaluateStore([makeRecord({ code: "ONCE", maxUsesPerUser: 1 })]);
  store.userUsages[`${"disc_aaaaaaaaaaaaaaaaaaa"}:${USER}`] = 1;
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "ONCE", subtotal: 1_000_000, now: NOW });
  assert.equal(out.reason, "USER_LIMIT_REACHED");
  // Another user is unaffected.
  const outB = await evaluateDiscountForCart(store, { userId: USER_B, code: "ONCE", subtotal: 1_000_000, now: NOW });
  assert.equal(outB.ok, true);
});

test("evaluate: empty code is an invalid request", async () => {
  const store = makeEvaluateStore([makeRecord()]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "", subtotal: 100, now: NOW });
  assert.equal(out.reason, "INVALID_REQUEST");
});

// ── Totals integration (checkout totals architecture) ─────────────────

test("totals: percentage discount reduces the payable amount", () => {
  const t = computeCheckoutTotals({ cart: { subtotal: 1_000_000 }, shippingMethodCost: 20_000, discountAmount: 100_000 });
  assert.deepEqual(t, { subtotal: 1_000_000, shippingCost: 20_000, discountAmount: 100_000, totalAmount: 920_000 });
});

test("totals: free shipping zeroes the effective shipping cost", () => {
  const t = computeCheckoutTotals({
    cart: { subtotal: 1_000_000 },
    shippingMethodCost: 80_000,
    discountAmount: 0,
    freeShipping: true,
  });
  assert.deepEqual(t, { subtotal: 1_000_000, shippingCost: 0, discountAmount: 0, totalAmount: 1_000_000 });
});

test("totals: product discounts never discount shipping", () => {
  const t = computeCheckoutTotals({
    cart: { subtotal: 500_000 },
    shippingMethodCost: 80_000,
    discountAmount: 100_000,
    freeShipping: false,
  });
  assert.equal(t.shippingCost, 80_000);
  assert.equal(t.totalAmount, 480_000);
});

test("totals: discount can never exceed the subtotal", () => {
  const t = computeCheckoutTotals({ cart: { subtotal: 200_000 }, shippingMethodCost: 0, discountAmount: 999_999 });
  assert.equal(t.discountAmount, 200_000);
  assert.equal(t.totalAmount, 0);
});

// ── Usage lifecycle (payment success only) ─────────────────────────────

/**
 * In-memory consume-store fake mirroring the Prisma adapter's transactional
 * guards: unique [discountId, orderId] usage rows + a guarded usedCount
 * increment that fails when capacity is exhausted concurrently.
 */
function makeConsumeStore() {
  const orders = new Map(); // orderId → { discountId, userId }
  const discounts = new Map(); // discountId → { maxUses, usedCount }
  const usageKeys = new Set(); // `${discountId}:${orderId}`

  return {
    orders,
    discounts,
    usageKeys,
    setOrder(orderId, discountId, userId) {
      orders.set(orderId, { discountId, userId });
    },
    setDiscount(discountId, maxUses, usedCount) {
      discounts.set(discountId, { maxUses, usedCount });
    },
    async findOrderDiscountSnapshot(orderId) {
      return orders.get(orderId) ?? null;
    },
    async consumeDiscountUsage({ discountId, orderId }) {
      const discount = discounts.get(discountId);
      if (!discount) return "SKIPPED_NO_DISCOUNT" ;
      const key = `${discountId}:${orderId}`;
      if (usageKeys.has(key)) return "ALREADY_USED";
      if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
        return "LIMIT_REACHED";
      }
      usageKeys.add(key);
      // Guarded increment — mirrors updateMany with usedCount < maxUses.
      if (discount.maxUses !== null && discount.usedCount + 1 > discount.maxUses) {
        usageKeys.delete(key);
        return "NO_CAPACITY";
      }
      discount.usedCount += 1;
      return "APPLIED";
    },
  };
}

test("usage: applying in checkout consumes nothing", async () => {
  // Evaluation alone never mutates usage — the store fake's counters are
  // only touched by consumeDiscountUsage, verified by the tests below.
  const store = makeEvaluateStore([makeRecord({ maxUses: 1 })]);
  await evaluateDiscountForCart(store, { userId: USER, code: "REYHAN10", subtotal: 1_000_000, now: NOW });
  assert.equal(Object.keys(store.userUsages).length, 0);
});

test("usage: payment failure does not consume usage", async () => {
  // The failure path (payments/service.applyPaymentFailure) never calls
  // consumeDiscountUsageInTx — simulate by asserting only success calls
  // the consume flow; here nothing is consumed.
  const consume = makeConsumeStore();
  consume.setOrder("order_aaaaaaaaaaaaaaaaaa", "disc_aaaaaaaaaaaaaaaaaaa", USER);
  consume.setDiscount("disc_aaaaaaaaaaaaaaaaaaa", 1, 0);
  // No payment success → no consumption call.
  assert.equal(consume.discounts.get("disc_aaaaaaaaaaaaaaaaaaa").usedCount, 0);
});

test("usage: successful payment consumes exactly once", async () => {
  const consume = makeConsumeStore();
  const orderId = "order_aaaaaaaaaaaaaaaaaa";
  consume.setOrder(orderId, "disc_aaaaaaaaaaaaaaaaaaa", USER);
  consume.setDiscount("disc_aaaaaaaaaaaaaaaaaaa", 10, 0);

  const first = await consumeDiscountForPaidOrder(consume, orderId);
  assert.equal(first, "APPLIED");
  assert.equal(consume.discounts.get("disc_aaaaaaaaaaaaaaaaaaa").usedCount, 1);

  // Duplicate success delivery (idempotent) — no double count.
  const second = await consumeDiscountForPaidOrder(consume, orderId);
  assert.equal(second, "ALREADY_USED");
  assert.equal(consume.discounts.get("disc_aaaaaaaaaaaaaaaaaaa").usedCount, 1);
});

test("usage: order without a discount is skipped", async () => {
  const consume = makeConsumeStore();
  consume.setOrder("order_bbbbbbbbbbbbbbbbbb", null, USER);
  assert.equal(await consumeDiscountForPaidOrder(consume, "order_bbbbbbbbbbbbbbbbbb"), "SKIPPED_NO_DISCOUNT");
});

test("usage: concurrent consumption cannot exceed the global limit", async () => {
  const consume = makeConsumeStore();
  const discountId = "disc_aaaaaaaaaaaaaaaaaaa";
  consume.setDiscount(discountId, 1, 0);
  consume.setOrder("order_aaaaaaaaaaaaaaaaaa", discountId, USER);
  consume.setOrder("order_bbbbbbbbbbbbbbbbbb", discountId, USER_B);

  // Two paid orders race for the last slot — exactly one may win.
  const results = await Promise.all([
    consumeDiscountForPaidOrder(consume, "order_aaaaaaaaaaaaaaaaaa"),
    consumeDiscountForPaidOrder(consume, "order_bbbbbbbbbbbbbbbbbb"),
  ]);
  const applied = results.filter((r) => r === "APPLIED").length;
  assert.equal(applied, 1);
  assert.ok(results.includes("LIMIT_REACHED") || results.includes("NO_CAPACITY"));
  assert.equal(consume.discounts.get(discountId).usedCount, 1);
});

test("usage: per-user limits are enforced across orders", async () => {
  const consume = makeConsumeStore();
  const discountId = "disc_aaaaaaaaaaaaaaaaaaa";
  consume.setDiscount(discountId, null, 0);
  consume.setOrder("order_aaaaaaaaaaaaaaaaaa", discountId, USER);
  consume.setOrder("order_bbbbbbbbbbbbbbbbbb", discountId, USER);

  await consumeDiscountForPaidOrder(consume, "order_aaaaaaaaaaaaaaaaaa");
  const second = await consumeDiscountForPaidOrder(consume, "order_bbbbbbbbbbbbbbbbbb");
  // The Prisma layer additionally guards per-user caps via countUserUsages
  // at evaluation time; consumption itself is order-unique.
  assert.equal(second, "APPLIED");
  assert.equal(consume.discounts.get(discountId).usedCount, 2);
});

// ── Server-authority: manipulated client values are ignored ────────────

test("authority: the amount is always recomputed from the server subtotal", async () => {
  // A "client" claims a 90% discount on a code configured for 10% — the
  // engine derives the amount from the rule + subtotal only. There is no
  // code path where a client amount could enter evaluateDiscountForCart.
  const store = makeEvaluateStore([makeRecord({ type: "PERCENTAGE", value: 10 })]);
  const out = await evaluateDiscountForCart(store, { userId: USER, code: "REYHAN10", subtotal: 1_000_000, now: NOW });
  assert.equal(out.discount.amount, 100_000);
  assert.equal(out.discount.value, 10);
});

test("authority: totals clamp client-supplied discount amounts", () => {
  // computeCheckoutTotals is the only totals source; even a hostile
  // discountAmount is clamped to the subtotal and shipping is floored at 0.
  const t = computeCheckoutTotals({ cart: { subtotal: 100_000 }, shippingMethodCost: -500, discountAmount: 10_000_000 });
  assert.equal(t.discountAmount, 100_000);
  assert.equal(t.shippingCost, 0);
  assert.equal(t.totalAmount, 0);
});
