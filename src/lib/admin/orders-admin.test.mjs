// Unit tests — Phase 14 Part 2 order administration rules (pure, DB-free).
// Covers transition validation against the existing order state machine,
// the cancellation/inventory-restore decision, truthful payment messaging,
// and the display-safe payment whitelist.

import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedOrderTransitions,
  evaluateOrderStatusChange,
  shouldRestoreInventoryOn,
  requiresOrderConfirmation,
  cancellationPaymentNotice,
  toAdminPaymentFacts,
  ORDER_FULFILLMENT_STEPS,
  ORDER_CANCEL_RESTOCK_REASON,
  ORDER_ADMIN_MESSAGES,
} from "./order-admin-rules.ts";

test("allowed transitions follow the existing order state machine", () => {
  const pending = allowedOrderTransitions("PENDING");
  assert.ok(pending.includes("CONFIRMED"));
  assert.ok(pending.includes("CANCELLED"));
  assert.deepEqual(allowedOrderTransitions("SHIPPED"), ["DELIVERED"]);
  assert.deepEqual(allowedOrderTransitions("DELIVERED"), ["RETURNED"]);
  assert.deepEqual(allowedOrderTransitions("CANCELLED"), []);
});

test("valid transitions pass; invalid/same/terminal are rejected", () => {
  assert.deepEqual(evaluateOrderStatusChange("PENDING", "CONFIRMED"), { ok: true });
  assert.deepEqual(evaluateOrderStatusChange("CONFIRMED", "PROCESSING"), { ok: true });
  assert.deepEqual(evaluateOrderStatusChange("PROCESSING", "CANCELLED"), { ok: true });

  assert.deepEqual(evaluateOrderStatusChange("PENDING", "PENDING"), {
    ok: false,
    reason: "SAME_STATUS",
  });
  assert.deepEqual(evaluateOrderStatusChange("PENDING", "SHIPPED"), {
    ok: false,
    reason: "INVALID_TRANSITION",
  });
  assert.deepEqual(evaluateOrderStatusChange("CANCELLED", "CONFIRMED"), {
    ok: false,
    reason: "INVALID_TRANSITION",
  });
  assert.deepEqual(evaluateOrderStatusChange("DELIVERED", "PENDING"), {
    ok: false,
    reason: "INVALID_TRANSITION",
  });
});

test("inventory is restored only on cancellation", () => {
  assert.equal(shouldRestoreInventoryOn("CANCELLED"), true);
  for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED"]) {
    assert.equal(shouldRestoreInventoryOn(s), false, s);
  }
  assert.equal(typeof ORDER_CANCEL_RESTOCK_REASON, "string");
  assert.ok(ORDER_CANCEL_RESTOCK_REASON.length > 0);
});

test("terminal transitions require confirmation", () => {
  assert.equal(requiresOrderConfirmation("CANCELLED"), true);
  assert.equal(requiresOrderConfirmation("RETURNED"), true);
  assert.equal(requiresOrderConfirmation("PROCESSING"), false);
  assert.equal(requiresOrderConfirmation("SHIPPED"), false);
});

test("cancellation messaging never claims a refund", () => {
  const paid = cancellationPaymentNotice("PAID");
  assert.ok(paid && paid.length > 0);
  assert.ok(!paid.includes("بازگشت وجه انجام شد"));

  assert.equal(cancellationPaymentNotice("PENDING"), null);
  assert.ok(cancellationPaymentNotice("REFUNDED"));
});

test("fulfillment steps match the happy-path chain", () => {
  assert.deepEqual(ORDER_FULFILLMENT_STEPS, [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
  ]);
});

test("payment inspection whitelist drops gateway secrets", () => {
  const row = {
    id: "p1",
    method: "ONLINE",
    provider: "ZARINPAL",
    status: "PAID",
    amount: 1_500_000,
    transactionId: "REF-123",
    paidAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    authority: "A000000000000000000000000000000000",
    meta: { cardMask: "6037****", internal: "secret" },
  };
  const facts = toAdminPaymentFacts(row);
  assert.equal(facts.id, "p1");
  assert.equal(facts.transactionId, "REF-123");
  assert.equal(facts.amount, 1_500_000);
  assert.ok(!("authority" in facts));
  assert.ok(!("meta" in facts));
});

test("every order admin error code has Persian copy", () => {
  for (const code of [
    "FORBIDDEN",
    "NOT_FOUND",
    "VALIDATION",
    "INVALID_TRANSITION",
    "SAME_STATUS",
    "CONFLICT",
    "DB_ERROR",
  ]) {
    assert.ok(ORDER_ADMIN_MESSAGES[code]?.length > 0, code);
  }
});