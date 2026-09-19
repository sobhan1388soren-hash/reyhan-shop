// Payment finalization engine — pure core of the payment lifecycle.
//
// This module owns the money-critical invariants and is deliberately
// database-agnostic: persistence is expressed as a narrow FinalizePaymentStore
// port (see `applyPaymentService` in ./service for the Prisma-backed
// adapter). That keeps the engine unit-testable with an in-memory fake,
// mirroring the Phase 9 approach of testing all pure logic without Postgres.
//
// Invariants enforced here:
//   1. Ownership — a payment is only addressable through the session user;
//      foreign ids resolve to NOT_FOUND/FORBIDDEN, never to data.
//   2. Amounts — a payment may only succeed when its amount exactly equals
//      the order total; both values are server-stored Int Rial. Client
//      input never reaches this module.
//   3. Terminal immutability — PAID/FAILED/CANCELLED/REFUNDED rows are never
//      re-opened; success is idempotent (replays are no-ops), never duplicated.
//   4. Order/payment consistency — payment PENDING→PAID and order
//      PENDING→CONFIRMED/paymentStatus→PAID flip atomically (the store
//      adapter runs both writes in one transaction and throws to roll back
//      on guard mismatch, so contradictory states cannot persist).
//   5. No inventory writes — stock was decremented exactly once by the
//      Phase 9 atomic order creation; finalization never touches inventory.
//   6. No order creation — duplicate callbacks can never create orders or
//      additional payment rows; only status transitions exist here.
//
// Gateway transport failures (request failure / timeout / invalid response,
// thrown by adapters as PaymentGatewayError) are handled by finalizing the
// payment with a FAILURE intent — see ./service.mapGatewayErrorToIntent.

import type {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
} from "@prisma/client";
import type { PaymentRejectReason } from "./errors.ts";
import { canTransitionPaymentStatus } from "./status.ts";
import { amountsMatch } from "./amount.ts";

export type PaymentRecordView = {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionId: string | null;
  createdAt: Date;
};

export type OrderRecordView = {
  id: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
};

export type PaymentWithOrderView = {
  payment: PaymentRecordView;
  order: OrderRecordView;
};

/** Thrown by store adapters when an atomic guard rejected a write pair —
 *  the adapter's transaction has already rolled back at that point. */
export class PaymentStateConflictError extends Error {
  constructor(detail = "") {
    super(`PAYMENT_STATE_CONFLICT:${detail}`);
    this.name = "PaymentStateConflictError";
  }
}

export type ApplySuccessInput = {
  paymentId: string;
  /** Gateway reference — persisted as the immutable transactionId. */
  transactionId: string;
  paidAt: Date;
  meta: Record<string, unknown> | null;
};

export type ApplyFailureInput = {
  paymentId: string;
  to: "FAILED" | "CANCELLED";
};

export interface FinalizePaymentStore {
  /** Ownership lives in the query: the payment is joined to the user's
   *  order; foreign payments are indistinguishable from missing ones. */
  findPaymentWithOrderForUser(
    paymentId: string,
    userId: string
  ): Promise<PaymentWithOrderView | null>;

  /** Atomically: payment PENDING→PAID (transactionId/paidAt/meta recorded)
   *  AND order PENDING→CONFIRMED + paymentStatus→PAID. Returns
   *  "PAYMENT_ALREADY_PAID" when a concurrent writer won the same
   *  transition; throws PaymentStateConflictError (rolling back) when the
   *  paired order is not in the expected PENDING/PENDING state. */
  applyPaymentSuccess(input: ApplySuccessInput & { orderId: string }): Promise<
    "APPLIED" | "PAYMENT_ALREADY_PAID"
  >;

  /** Atomically: payment PENDING→FAILED/CANCELLED AND order
   *  paymentStatus→FAILED/CANCELLED (order stays PENDING so the customer
   *  can retry with a new payment attempt in Phase 10-B). Returns
   *  "ALREADY_RESOLVED" when a concurrent writer resolved it first. */
  applyPaymentFailure(input: ApplyFailureInput & { orderId: string }): Promise<
    "APPLIED" | "ALREADY_RESOLVED"
  >;
}

export type FinalizeIntent =
  | {
      kind: "SUCCESS";
      transactionId: string;
      paidAt?: Date;
      meta?: Record<string, unknown> | null;
    }
  | { kind: "FAILURE"; to: "FAILED" | "CANCELLED" };

export type FinalizeOutcome =
  /** Transition written and persisted (first delivery). */
  | {
      ok: true;
      transitioned: true;
      paymentStatus: PaymentStatus;
      orderStatus: OrderStatus | null;
    }
  /** Duplicate/replay delivery — the exact target state already exists.
   *  Nothing was written; no side effects ran. */
  | { ok: true; transitioned: false; paymentStatus: PaymentStatus }
  /** Rejected with a stable machine code; nothing was written. */
  | { ok: false; reason: PaymentRejectReason };

// Gateway reference validation — references are opaque provider tokens
// (ZarinPal authorities are 36-char hex-dash strings). Anything hostile
// is rejected before it can touch the payment row.
const GATEWAY_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_]{7,79}$/;

export function isValidGatewayRef(ref: unknown): ref is string {
  return typeof ref === "string" && GATEWAY_REF_PATTERN.test(ref);
}

function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.length >= 10 && id.length <= 64;
}

/**
 * Resolve one payment attempt. All duplicate deliveries of the same
 * outcome are safe: the first write wins, replays return unchanged.
 */
export async function finalizePayment(
  store: FinalizePaymentStore,
  userId: string,
  paymentId: string,
  intent: FinalizeIntent
): Promise<FinalizeOutcome> {
  if (!isValidId(userId) || !isValidId(paymentId) || !intent) {
    return { ok: false, reason: "INVALID_REQUEST" };
  }

  const view = await store.findPaymentWithOrderForUser(paymentId, userId);
  if (!view) return { ok: false, reason: "NOT_FOUND" };

  // Defensive invariants on server-stored amounts — a corrupt row can
  // never be pushed through the success path.
  if (!amountsMatch(view.payment.amount, view.order.totalAmount)) {
    return { ok: false, reason: "AMOUNT_MISMATCH" };
  }

  const current = view.payment.status;

  if (intent.kind === "SUCCESS") {
    if (!isValidGatewayRef(intent.transactionId)) {
      return { ok: false, reason: "INVALID_REQUEST" };
    }
    const paidAt = intent.paidAt ?? new Date();
    const meta = intent.meta ?? null;

    if (current === "PAID") {
      // Idempotent only when the reference matches — the same verified
      // callback delivered twice. A different reference claiming success
      // on a paid payment is rejected outright.
      return view.payment.transactionId === intent.transactionId
        ? { ok: true, transitioned: false, paymentStatus: "PAID" }
        : { ok: false, reason: "ALREADY_PAID" };
    }
    if (current !== "PENDING") {
      return { ok: false, reason: "INVALID_TRANSITION" };
    }

    let result;
    try {
      result = await store.applyPaymentSuccess({
        paymentId,
        orderId: view.order.id,
        transactionId: intent.transactionId,
        paidAt,
        meta,
      });
    } catch (e) {
      if (e instanceof PaymentStateConflictError) {
        // Order guard rejected the pair — re-read and classify: either a
        // concurrent success already landed (idempotent) or the order row
        // is in a state payments may not touch (conflict, nothing written).
        const recheck = await store.findPaymentWithOrderForUser(
          paymentId,
          userId
        );
        if (recheck?.payment.status === "PAID") {
          return { ok: true, transitioned: false, paymentStatus: "PAID" };
        }
        return { ok: false, reason: "STATE_CONFLICT" };
      }
      throw e;
    }

    if (result === "APPLIED") {
      return {
        ok: true,
        transitioned: true,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
      };
    }
    // PAYMENT_ALREADY_PAID — concurrent duplicate won the race.
    return { ok: true, transitioned: false, paymentStatus: "PAID" };
  }

  // FAILURE / CANCELLED intent
  const target = intent.to;
  if (current === target) {
    // Duplicate negative callback — already recorded, nothing to do.
    return { ok: true, transitioned: false, paymentStatus: target };
  }
  if (current === "PAID") {
    // The gateway may not retroactively fail a settled payment.
    return { ok: false, reason: "ALREADY_PAID" };
  }
  if (current !== "PENDING") {
    // FAILED↔CANCELLED, or anything touching REFUNDED.
    return { ok: false, reason: "INVALID_TRANSITION" };
  }
  if (!canTransitionPaymentStatus(current, target)) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  let result;
  try {
    result = await store.applyPaymentFailure({
      paymentId,
      orderId: view.order.id,
      to: target,
    });
  } catch (e) {
    if (e instanceof PaymentStateConflictError) {
      const recheck = await store.findPaymentWithOrderForUser(
        paymentId,
        userId
      );
      if (recheck?.payment.status === target) {
        return { ok: true, transitioned: false, paymentStatus: target };
      }
      return { ok: false, reason: "STATE_CONFLICT" };
    }
    throw e;
  }

  if (result === "APPLIED") {
    return {
      ok: true,
      transitioned: true,
      paymentStatus: target,
      // Order status intentionally untouched — stays PENDING for retry.
      orderStatus: null,
    };
  }
  return { ok: true, transitioned: false, paymentStatus: target };
}
