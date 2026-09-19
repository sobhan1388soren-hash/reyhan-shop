// Order administration domain — pure, DB-free rules (Phase 14, Part 2).
//
// Reuses the existing payment/order state machine in
// src/lib/payments/status.ts (single source of truth for legal
// transitions) and the label/step maps in src/lib/auth/labels.ts.
//
// Security / integrity model:
//   - admin status changes are validated against the SAME transition table
//     the payment engine uses — arbitrary status writes are impossible
//   - cancellation only restores inventory (goods never left the shop);
//     payment state is NEVER touched here, so a paid order stays visibly
//     PAID and no refund is ever fabricated
//   - payment inspection is a strict whitelist: gateway `meta` and the
//     gateway `authority` token are never part of the display model

import type { OrderStatus, PaymentStatus } from "@prisma/client";
import {
  canTransitionOrderStatus,
  ORDER_TERMINAL_STATUSES,
  ORDER_STATUS_TRANSITIONS,
} from "../payments/status.ts";

export { ORDER_TERMINAL_STATUSES };

/** The happy-path fulfillment chain (used by the stepper UI). */
export const ORDER_FULFILLMENT_STEPS: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

/** Allowed next statuses for a given current status (transition table). */
export function allowedOrderTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[from] ?? [];
}

export type OrderTransitionReason = "INVALID_TRANSITION" | "SAME_STATUS";

export type OrderTransitionEvaluation =
  | { ok: true }
  | { ok: false; reason: OrderTransitionReason };

/** Validate an admin-requested order status change against the machine. */
export function evaluateOrderStatusChange(
  current: OrderStatus,
  target: OrderStatus
): OrderTransitionEvaluation {
  if (current === target) return { ok: false, reason: "SAME_STATUS" };
  if (!canTransitionOrderStatus(current, target)) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }
  return { ok: true };
}

/**
 * Stock is restored ONLY on cancellation, and only for orders cancelled
 * before delivery (PENDING/CONFIRMED/PROCESSING) whose items were already
 * decremented at order creation.
 */
export function shouldRestoreInventoryOn(target: OrderStatus): boolean {
  return target === "CANCELLED";
}

/** Audit reason written to InventoryTransaction when stock is restored. */
export const ORDER_CANCEL_RESTOCK_REASON = "CANCEL_RESTOCK";

/** Terminal transitions are high-impact and require explicit confirmation. */
export function requiresOrderConfirmation(target: OrderStatus): boolean {
  return (ORDER_TERMINAL_STATUSES as readonly string[]).includes(target);
}

/**
 * Truthful payment notice shown alongside cancellation. A paid order is
 * cancelled (status only) — the payment remains PAID and NO refund is
 * executed by this module (refunds are not an approved flow).
 */
export function cancellationPaymentNotice(paymentStatus: PaymentStatus): string | null {
  if (paymentStatus === "PAID") {
    return "این سفارش پرداخت‌شده است. با لغو سفارش، وضعیت پرداخت «پرداخت‌شده» باقی می‌ماند و بازگشت وجه به‌صورت خودکار انجام نمی‌شود.";
  }
  if (paymentStatus === "REFUNDED") {
    return "وجه این سفارش پیش‌تر بازگشت داده شده است.";
  }
  return null;
}

// ── Payment inspection (display-safe whitelist) ────────────────────────

export type RawAdminPaymentRow = {
  id: string;
  method: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  transactionId: string | null;
  paidAt: Date | null;
  createdAt: Date;
  /** Present on the DB row but deliberately never exposed to the admin. */
  authority?: string | null;
  meta?: unknown;
};

export type AdminPaymentFacts = {
  id: string;
  method: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  transactionId: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

/**
 * Whitelist mapper for admin payment inspection. Only the display-safe
 * facts are copied out; gateway `meta` JSON, the `authority` token, and any
 * future secret-bearing column are dropped by construction.
 */
export function toAdminPaymentFacts(row: RawAdminPaymentRow): AdminPaymentFacts {
  return {
    id: row.id,
    method: row.method,
    provider: row.provider,
    status: row.status,
    amount: row.amount,
    transactionId: row.transactionId,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

// ── Stable machine codes → Persian copy ────────────────────────────────

export type OrderAdminErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "SAME_STATUS"
  | "CONFLICT"
  | "DB_ERROR";

export const ORDER_ADMIN_MESSAGES: Readonly<Record<OrderAdminErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  NOT_FOUND: "سفارش موردنظر یافت نشد.",
  VALIDATION: "درخواست معتبر نیست.",
  INVALID_TRANSITION: "تغییر وضعیت درخواستی برای این سفارش مجاز نیست.",
  SAME_STATUS: "سفارش از قبل در این وضعیت قرار دارد.",
  CONFLICT: "وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را بازخوانی کنید.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};