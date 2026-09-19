// Payment & order status state machines — pure, no DB, no server-only.
// Single source of truth for which status transitions are legal. Kept
// separate from UI label maps (auth/labels) and from the Prisma schema so
// the rules are unit-testable and reusable by the finalization engine.

import type { OrderStatus, PaymentStatus } from "@prisma/client";

//
// Payment status lifecycle
//
// PENDING is the only mutable state: it resolves to exactly one of
// PAID / FAILED / CANCELLED. Terminal rows are never re-opened in this
// phase — a retry opens a NEW payment attempt (Phase 10-B decides how).
// PAID → REFUNDED is refund territory and deliberately deferred.
//

export const PAYMENT_TERMINAL_STATUSES: readonly PaymentStatus[] = [
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

export const PAYMENT_STATUS_TRANSITIONS: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  PENDING: ["PAID", "FAILED", "CANCELLED"],
  PAID: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return PAYMENT_TERMINAL_STATUSES.includes(status);
}

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}

//
// Order status lifecycle (payment-driven subset)
//
// Payments may only move PENDING → CONFIRMED (on success) or leave the
// order PENDING (on failure/cancel, so payment can be retried). The
// post-CONFIRMED fulfillment chain is listed for completeness but is NOT
// driven by payments in this phase.
//

export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [
  "CANCELLED",
  "RETURNED",
];

export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TERMINAL_STATUSES.includes(status);
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * How a resolved payment status is mirrored onto the order.
 * `orderStatus: null` means the order's own status is untouched (order
 * stays PENDING — the payment outcome is recorded on paymentStatus only).
 */
export const ORDER_EFFECT_BY_PAYMENT_STATUS: Readonly<
  Record<
    PaymentStatus,
    { orderStatus: OrderStatus | null; orderPaymentStatus: PaymentStatus | null }
  >
> = {
  PENDING: { orderStatus: null, orderPaymentStatus: null },
  PAID: { orderStatus: "CONFIRMED", orderPaymentStatus: "PAID" },
  FAILED: { orderStatus: null, orderPaymentStatus: "FAILED" },
  CANCELLED: { orderStatus: null, orderPaymentStatus: "CANCELLED" },
  REFUNDED: { orderStatus: null, orderPaymentStatus: "REFUNDED" }, // Phase 11+
};

export function nextOrderStatusForPayment(
  paymentStatus: PaymentStatus
): OrderStatus | null {
  return ORDER_EFFECT_BY_PAYMENT_STATUS[paymentStatus].orderStatus;
}

/**
 * A order can start a NEW payment attempt while it sits in PENDING with
 * no successful payment yet. Payment rows themselves are never retried —
 * this is the "retryable payment state" for the order as a whole.
 */
export function isPaymentRetryable(order: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}): boolean {
  return (
    order.status === "PENDING" &&
    (order.paymentStatus === "PENDING" ||
      order.paymentStatus === "FAILED" ||
      order.paymentStatus === "CANCELLED")
  );
}

//
// Staleness (timeout handling)
//
// A PENDING payment older than this is considered abandoned by the
// gateway flow and may be expired to CANCELLED without contacting anyone.
//

export const PAYMENT_STALE_AFTER_MS = 15 * 60 * 1000;

export function isPaymentStale(
  payment: { status: PaymentStatus; createdAt: Date },
  now: Date = new Date()
): boolean {
  if (payment.status !== "PENDING") return false;
  return now.getTime() - payment.createdAt.getTime() > PAYMENT_STALE_AFTER_MS;
}
