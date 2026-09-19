// Gateway payment flow — pure orchestration for Phase 10-B.
//
// Wires the provider-agnostic PaymentGateway contract (via the registry)
// to the Phase 10-A finalization engine, expressed entirely against
// injectable ports so the whole flow is unit-testable without a DB or a
// live gateway (tests inject an in-memory store + fake gateway).
//
// Invariants (all inherited from Phase 10-A, none weakened here):
//   - Ownership: every lookup is joined to the session user; foreign ids
//     are indistinguishable from missing ones.
//   - Amounts: the payable amount is ALWAYS order.totalAmount from the
//     stored row — request and verification both use it; client input
//     never reaches this module.
//   - The callback alone is NEVER proof of payment — only the gateway's
//     server-side verification may drive a SUCCESS finalization.
//   - Ambiguous gateway outcomes (timeout / transport error during
//     verification) leave the payment PENDING ("در حال بررسی پرداخت");
//     they never cancel or complete anything. Retrying verification is
//     safe and idempotent.
//   - No inventory writes, no order creation: retries open NEW payment
//     attempts; duplicate callbacks are idempotent no-ops.

import type { PaymentGateway } from "./gateway.ts";
import { PaymentGatewayError } from "./gateway.ts";
import type { FinalizePaymentStore, PaymentWithOrderView } from "./engine.ts";
import { finalizePayment, isValidGatewayRef } from "./engine.ts";
import { amountsMatch, isValidServerAmount } from "./amount.ts";
import { isPaymentRetryable } from "./status.ts";
import type { OrderStatus, PaymentStatus, PaymentProvider } from "@prisma/client";

// ── Ports ──────────────────────────────────────────────────────────────

export type GatewayFlowPayment = {
  id: string;
  amount: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** ZarinPal authority / provider token; null before the gateway call. */
  authority: string | null;
  createdAt: Date;
};

export type GatewayFlowOrder = {
  id: string;
  userId: string | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  payments: GatewayFlowPayment[];
};

/**
 * Persistence port for the live flow. Extends the Phase 10-A finalization
 * store (ownership-joined reads + atomic paired transitions) with the
 * three writes the live gateway flow needs. The Prisma adapter lives in
 * ./service; tests use an in-memory fake with identical guards.
 */
export interface GatewayFlowStore extends FinalizePaymentStore {
  findOrderWithPaymentsForUser(
    orderId: string,
    userId: string
  ): Promise<GatewayFlowOrder | null>;

  /** Locate a payment by its provider authority, joined to the owner. */
  findPaymentByAuthorityForUser(
    authority: string,
    userId: string
  ): Promise<PaymentWithOrderView | null>;

  /** Persist the provider authority on a still-PENDING payment attempt.
   *  Returns false when the row is no longer PENDING (lost race). */
  persistAuthorityOnPendingPayment(
    paymentId: string,
    provider: PaymentGateway["provider"],
    authority: string
  ): Promise<boolean>;

  /** Open a NEW payment attempt for a retry (never re-opens old rows). */
  createPaymentAttempt(
    orderId: string,
    amount: number,
    provider: PaymentGateway["provider"]
  ): Promise<{ id: string } | null>;
}

// ── Start: order → gateway request → redirect ──────────────────────────

export type StartGatewayPaymentOutcome =
  | { ok: true; kind: "REDIRECT"; paymentId: string; redirectUrl: string }
  /** An earlier attempt's authority verified on retry — already settled. */
  | { ok: true; kind: "VERIFIED_EXISTING"; paymentId: string; orderId: string }
  | { ok: true; kind: "ALREADY_PAID" }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_PAYABLE" | "AMOUNT_INVALID" | "GATEWAY_ERROR" | "STATE_CONFLICT";
    };

function isValidFlowId(id: unknown): id is string {
  return typeof id === "string" && id.length >= 10 && id.length <= 64;
}

/**
 * Begin (or safely re-begin) the gateway flow for one order:
 *   1. re-validate ownership + payable state server-side,
 *   2. derive the payable amount from the stored order row,
 *   3. if a PENDING attempt already carries an authority, re-verify it
 *      first (safe recovery from an ambiguous earlier verification),
 *   4. request a gateway session and persist the returned authority.
 *
 * The amount sent to the gateway is ALWAYS order.totalAmount — a
 * client-submitted amount can never enter this path.
 */
export async function startGatewayPayment(
  store: GatewayFlowStore,
  gateway: PaymentGateway,
  input: {
    userId: string;
    orderId: string;
    callbackUrl: string;
    siteName: string;
  }
): Promise<StartGatewayPaymentOutcome> {
  const { userId, orderId } = input;
  if (!isValidFlowId(userId) || !isValidFlowId(orderId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const order = await store.findOrderWithPaymentsForUser(orderId, userId);
  if (!order) return { ok: false, code: "NOT_FOUND" };

  if (order.paymentStatus === "PAID") {
    return { ok: true, kind: "ALREADY_PAID" };
  }
  if (!isPaymentRetryable({ status: order.status, paymentStatus: order.paymentStatus })) {
    return { ok: false, code: "NOT_PAYABLE" };
  }
  if (!isValidServerAmount(order.totalAmount)) {
    // Corrupt order row — never send a bogus amount to the gateway.
    return { ok: false, code: "AMOUNT_INVALID" };
  }

  // Latest still-PENDING attempt (newest first), if any.
  const pending = [...order.payments]
    .filter((p) => p.status === "PENDING")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  // An existing authority is re-verified BEFORE issuing a new one — the
  // money may already have been captured while the result was ambiguous.
  if (pending?.authority) {
    try {
      const verified = await gateway.verifyPayment({
        paymentId: pending.id,
        amount: order.totalAmount,
        authority: pending.authority,
      });
      const out = await finalizePayment(store, userId, pending.id, {
        kind: "SUCCESS",
        transactionId: verified.refId,
        meta: verified.meta ?? null,
      });
      if (out.ok) {
        return out.transitioned
          ? { ok: true, kind: "VERIFIED_EXISTING", paymentId: pending.id, orderId: order.id }
          : { ok: true, kind: "ALREADY_PAID" };
      }
      if (out.reason === "ALREADY_PAID") return { ok: true, kind: "ALREADY_PAID" };
      if (out.reason === "AMOUNT_MISMATCH") return { ok: false, code: "AMOUNT_INVALID" };
      return { ok: false, code: "STATE_CONFLICT" };
    } catch (e) {
      if (!(e instanceof PaymentGatewayError)) throw e;
      if (e.code !== "VERIFY_FAILED") {
        // Timeout / transport error — outcome unknown; keep everything
        // untouched so verification can be retried.
        return { ok: false, code: "GATEWAY_ERROR" };
      }
      // Definitively not paid — the authority is dead. Cancel the
      // attempt and open a fresh one below (order stays retryable).
      await finalizePayment(store, userId, pending.id, {
        kind: "FAILURE",
        to: "CANCELLED",
      });
    }
  }

  // Reuse the pre-gateway PENDING row (created with the order) or open a
  // new retry attempt. Terminal rows are never re-opened.
  let paymentId: string;
  if (pending && !pending.authority) {
    paymentId = pending.id;
  } else {
    const created = await store.createPaymentAttempt(
      order.id,
      order.totalAmount,
      gateway.provider
    );
    if (!created) return { ok: false, code: "GATEWAY_ERROR" };
    paymentId = created.id;
  }

  try {
    const request = await gateway.requestPayment({
      paymentId,
      amount: order.totalAmount,
      description: `تسویه سفارش ${order.orderNumber} — ${input.siteName}`,
      callbackUrl: input.callbackUrl,
    });
    if (!isValidGatewayRef(request.authority)) {
      // Hostile/garbage authority — never persist, never redirect.
      throw new PaymentGatewayError("INVALID_RESPONSE", "authority-invalid");
    }
    const persisted = await store.persistAuthorityOnPendingPayment(
      paymentId,
      gateway.provider,
      request.authority
    );
    if (!persisted) {
      // The attempt resolved concurrently — safe to just retry from the top.
      return { ok: false, code: "GATEWAY_ERROR" };
    }
    return { ok: true, kind: "REDIRECT", paymentId, redirectUrl: request.redirectUrl };
  } catch (e) {
    if (!(e instanceof PaymentGatewayError)) throw e;
    // Nothing was charged for a failed request — cancel the attempt so
    // the order stays cleanly retryable (Phase 10-A mapping).
    await finalizePayment(store, userId, paymentId, {
      kind: "FAILURE",
      to: "CANCELLED",
    });
    return { ok: false, code: "GATEWAY_ERROR" };
  }
}

// ── Callback: identify → verify server-side → finalize ─────────────────

export type GatewayCallbackOutcome =
  | { kind: "SUCCESS"; paymentId: string; orderId: string }
  | { kind: "ALREADY_PAID"; paymentId: string; orderId: string }
  | { kind: "CANCELLED"; paymentId: string; orderId: string }
  | { kind: "FAILED"; paymentId: string; orderId: string }
  /** Ambiguous (timeout / transport / terminal-state conflict) — the
   *  payment stays PENDING and is shown as "در حال بررسی پرداخت". */
  | { kind: "VERIFY_ERROR"; paymentId: string; orderId: string }
  /** Unknown/malformed authority, foreign payment, or absent status. */
  | { kind: "INVALID" };

/**
 * Resolve a gateway redirect callback. The provider params passed in are
 * ONLY a hint for which branch runs next — success is recorded EXCLUSIVELY
 * after the gateway's server-side verification with the authoritative
 * stored amount. Duplicate deliveries are idempotent through the engine.
 */
export async function handleGatewayCallback(
  store: GatewayFlowStore,
  gateway: PaymentGateway,
  input: {
    userId: string;
    authority: unknown;
    statusHint: "OK" | "NOK" | null;
  }
): Promise<GatewayCallbackOutcome> {
  const { userId } = input;
  if (!isValidFlowId(userId) || !isValidGatewayRef(input.authority)) {
    return { kind: "INVALID" };
  }
  const authority: string = input.authority;
  if (input.statusHint === null) {
    // Malformed redirect — no provider status to act on. Touch nothing.
    return { kind: "INVALID" };
  }

  const view = await store.findPaymentByAuthorityForUser(authority, userId);
  if (!view) return { kind: "INVALID" };

  const { payment, order } = view;
  const located = { paymentId: payment.id, orderId: order.id };

  // Stored-amount invariant before any gateway call.
  if (!amountsMatch(payment.amount, order.totalAmount)) {
    return { kind: "FAILED", ...located };
  }

  if (payment.status === "PAID") {
    // Duplicate/late callback for an already-settled payment — idempotent.
    return { kind: "ALREADY_PAID", ...located };
  }

  if (payment.status !== "PENDING") {
    // A terminal (failed/cancelled) attempt is claiming a callback. Verify
    // to learn whether money actually moved — terminal states are never
    // flipped automatically; a verified claim surfaces for review instead.
    try {
      await gateway.verifyPayment({
        paymentId: payment.id,
        amount: order.totalAmount,
        authority,
      });
      return { kind: "VERIFY_ERROR", ...located };
    } catch (e) {
      if (!(e instanceof PaymentGatewayError)) throw e;
      return e.code === "VERIFY_FAILED"
        ? { kind: "FAILED", ...located }
        : { kind: "VERIFY_ERROR", ...located };
    }
  }

  if (input.statusHint === "NOK") {
    // The customer cancelled at the gateway — nothing was charged.
    const out = await finalizePayment(store, userId, payment.id, {
      kind: "FAILURE",
      to: "CANCELLED",
    });
    if (out.ok) return { kind: "CANCELLED", ...located };
    return out.reason === "ALREADY_PAID"
      ? { kind: "ALREADY_PAID", ...located }
      : { kind: "FAILED", ...located };
  }

  // statusHint === "OK" — the gateway MIGHT have charged; proof only comes
  // from the server-to-server verification below.
  try {
    const verified = await gateway.verifyPayment({
      paymentId: payment.id,
      amount: order.totalAmount,
      authority,
    });
    const out = await finalizePayment(store, userId, payment.id, {
      kind: "SUCCESS",
      transactionId: verified.refId,
      meta: verified.meta ?? null,
    });
    if (out.ok) {
      return out.transitioned
        ? { kind: "SUCCESS", ...located }
        : { kind: "ALREADY_PAID", ...located };
    }
    if (out.reason === "ALREADY_PAID") return { kind: "ALREADY_PAID", ...located };
    if (out.reason === "AMOUNT_MISMATCH") return { kind: "FAILED", ...located };
    // STATE_CONFLICT / INVALID_TRANSITION — surfaced for review, never forced.
    return { kind: "VERIFY_ERROR", ...located };
  } catch (e) {
    if (!(e instanceof PaymentGatewayError)) throw e;
    if (e.code === "VERIFY_FAILED") {
      // Definitively not paid (rejected / amount tampered / dead authority).
      const out = await finalizePayment(store, userId, payment.id, {
        kind: "FAILURE",
        to: "FAILED",
      });
      if (out.ok) return { kind: "FAILED", ...located };
      return out.reason === "ALREADY_PAID"
        ? { kind: "ALREADY_PAID", ...located }
        : { kind: "VERIFY_ERROR", ...located };
    }
    // Timeout / transport error — the money state is UNKNOWN. Never fail
    // or complete the payment here; it stays PENDING and re-verification
    // is safe (startGatewayPayment re-verifies existing authorities).
    return { kind: "VERIFY_ERROR", ...located };
  }
}
