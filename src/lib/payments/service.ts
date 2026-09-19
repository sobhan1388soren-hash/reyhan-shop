// Payment service — server-only Prisma adapter for the pure finalization
// engine, plus user-scoped payment queries.
//
// Security model (matches Phase 9 conventions):
//   - every query is scoped to the session userId; foreign ids resolve to
//     NOT_FOUND and never leak existence or data
//   - amounts/refs come only from DB rows and gateway verification
//   - inventory is NEVER touched here (decremented once at order creation)
//   - no order/payment rows are created — only guarded transitions

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  FinalizePaymentStore,
  FinalizeIntent,
  FinalizeOutcome,
  PaymentRecordView,
  OrderRecordView,
} from "./engine.ts";
import { finalizePayment, isValidGatewayRef } from "./engine.ts";
import { PaymentStateConflictError } from "./engine.ts";
import type { PaymentGatewayError } from "./gateway.ts";
import type { PaymentStatus, OrderStatus, PaymentProvider } from "@prisma/client";
import type { GatewayFlowStore, GatewayFlowOrder, GatewayFlowPayment } from "./flow.ts";
import { getPaymentGateway } from "./registry.ts";

// ── Prisma-backed store adapter ───────────────────────────────────────

function toPaymentView(p: {
  id: string;
  orderId: string;
  amount: number;
  method: "ONLINE" | "COD" | "CARD_TO_CARD";
  provider: "ZARINPAL" | "MELLAT" | "PASARGAD" | "MANUAL" | "OTHER";
  status: PaymentStatus;
  transactionId: string | null;
  createdAt: Date;
}): PaymentRecordView {
  return {
    id: p.id,
    orderId: p.orderId,
    amount: p.amount,
    method: p.method,
    provider: p.provider,
    status: p.status,
    transactionId: p.transactionId,
    createdAt: p.createdAt,
  };
}

function toOrderView(o: {
  id: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
}): OrderRecordView {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalAmount: o.totalAmount,
  };
}

/**
 * Prisma store adapter for the finalization engine. Both paired writes
 * (payment + order) run inside ONE interactive transaction guarded by
 * status where-clauses — a lost race or an unexpected order state throws
 * and rolls the whole pair back, so contradictory combinations can never
 * persist.
 */
export const prismaFinalizeStore: FinalizePaymentStore = {
  async findPaymentWithOrderForUser(paymentId, userId) {
    const row = await prisma.payment.findFirst({
      where: { id: paymentId, order: { userId } },
      include: { order: { select: { id: true, userId: true, status: true, paymentStatus: true, totalAmount: true } } },
    });
    if (!row) return null;
    return { payment: toPaymentView(row), order: toOrderView(row.order) };
  },

  async applyPaymentSuccess(input) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: input.paymentId, status: "PENDING" },
        data: {
          status: "PAID",
          transactionId: input.transactionId,
          paidAt: input.paidAt,
          meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      if (updated.count === 0) return "PAYMENT_ALREADY_PAID" as const;

      const order = await tx.order.updateMany({
        where: {
          id: input.orderId,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        data: { status: "CONFIRMED", paymentStatus: "PAID" },
      });
      // The paired order write failed inside the same transaction —
      // throw so the transaction (including the payment write) rolls back.
      if (order.count === 0) {
        throw new PaymentStateConflictError("order-not-pending");
      }

      // ── Phase 12: consume the discount usage NOW — the payment has
      // reached the success state, so this is the only moment the usage
      // may be consumed. Runs inside the same transaction; the helper
      // re-reads the order's own discount snapshot (discountId, userId),
      // so no discount facts are taken from the caller's input. The
      // unique [discountId, orderId] row + guarded increment keep the
      // counters race-safe; failure/pending payments never reach here.
      const { consumeDiscountUsageInTx } = await import("@/lib/discounts/service");
      await consumeDiscountUsageInTx(tx, input.orderId);

      return "APPLIED" as const;
    });
  },

  async applyPaymentFailure(input) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: input.paymentId, status: "PENDING" },
        data: { status: input.to },
      });
      if (updated.count === 0) return "ALREADY_RESOLVED" as const;

      const order = await tx.order.updateMany({
        where: {
          id: input.orderId,
          // Order status stays PENDING — only paymentStatus is mirrored.
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        data: { paymentStatus: input.to },
      });
      if (order.count === 0) {
        throw new PaymentStateConflictError("order-not-pending");
      }
      return "APPLIED" as const;
    });
  },
};

// ── Gateway flow store adapter (Phase 10-B) ─────────────────────────────

function toFlowPayment(p: {
  id: string;
  amount: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  authority: string | null;
  createdAt: Date;
}): GatewayFlowPayment {
  return {
    id: p.id,
    amount: p.amount,
    provider: p.provider,
    status: p.status,
    authority: p.authority,
    createdAt: p.createdAt,
  };
}

/**
 * Prisma adapter for the Phase 10-B gateway flow. Ownership always lives
 * in the query (joined through the user's order); authority lookups are
 * scoped the same way so a foreign authority is indistinguishable from a
 * missing one. All writes are guarded updates — lost races return false
 * or "ALREADY_*" instead of writing contradictory state.
 */
export const prismaGatewayFlowStore: GatewayFlowStore = {
  ...prismaFinalizeStore,

  async findOrderWithPaymentsForUser(orderId, userId) {
    try {
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId },
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              provider: true,
              status: true,
              authority: true,
              createdAt: true,
            },
          },
        },
      });
      if (!order) return null;
      return {
        id: order.id,
        userId: order.userId,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        payments: order.payments.map(toFlowPayment),
      } satisfies GatewayFlowOrder;
    } catch {
      return null;
    }
  },

  async findPaymentByAuthorityForUser(authority, userId) {
    if (!isValidGatewayRef(authority)) return null;
    try {
      const row = await prisma.payment.findFirst({
        where: { authority, order: { userId } },
        include: {
          order: {
            select: { id: true, userId: true, status: true, paymentStatus: true, totalAmount: true },
          },
        },
      });
      if (!row) return null;
      return { payment: toPaymentView(row), order: toOrderView(row.order) };
    } catch {
      return null;
    }
  },

  async persistAuthorityOnPendingPayment(paymentId, provider, authority) {
    if (!isValidGatewayRef(authority)) return false;
    try {
      const updated = await prisma.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { authority, provider },
      });
      return updated.count === 1;
    } catch {
      return false;
    }
  },

  async createPaymentAttempt(orderId, amount, provider) {
    try {
      // Only for a still-payable order — never for settled/cancelled ones.
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          status: "PENDING",
          paymentStatus: { in: ["PENDING", "FAILED", "CANCELLED"] },
        },
        select: { totalAmount: true },
      });
      if (!order || order.totalAmount !== amount) return null;
      const payment = await prisma.payment.create({
        data: { orderId, amount, method: "ONLINE", provider, status: "PENDING" },
        select: { id: true },
      });
      return payment;
    } catch {
      return null;
    }
  },
};

// ── Public service API (server actions / route handlers call these) ────

/**
 * Resolve one payment attempt for the session user. Pure engine on top of
 * the Prisma store — this is the ONLY entry point production code uses to
 * change payment state (Phase 10-B's callback will call it too).
 */
export async function resolveUserPayment(
  userId: string,
  paymentId: string,
  intent: FinalizeIntent
): Promise<FinalizeOutcome> {
  return finalizePayment(prismaFinalizeStore, userId, paymentId, intent);
}

/**
 * Begin the live gateway flow for one of the user's orders. Server-side
 * re-validation, authoritative amount, authority persistence, and the
 * gateway session all run here; the caller only sees a redirect URL.
 * The provider is resolved from the registry — this module stays
 * provider-agnostic.
 */
export async function startUserGatewayPayment(input: {
  userId: string;
  orderId: string;
  callbackUrl: string;
  siteName: string;
}) {
  const { startGatewayPayment } = await import("./flow.ts");
  return startGatewayPayment(prismaGatewayFlowStore, getPaymentGateway(), {
    userId: input.userId,
    orderId: input.orderId,
    callbackUrl: input.callbackUrl,
    siteName: input.siteName,
  });
}

/**
 * Resolve a gateway redirect callback for the session user. Provider
 * params are hints only — success is recorded exclusively after the
 * gateway's server-side verification with the stored authoritative amount.
 */
export async function handleUserGatewayCallback(input: {
  userId: string;
  authority: unknown;
  statusHint: "OK" | "NOK" | null;
}) {
  const { handleGatewayCallback } = await import("./flow.ts");
  return handleGatewayCallback(prismaGatewayFlowStore, getPaymentGateway(), {
    userId: input.userId,
    authority: input.authority,
    statusHint: input.statusHint,
  });
}

/**
 * Gateway transport failures → finalization intents. A failed/timed-out/
 * malformed gateway request cancels the payment attempt so the order can
 * be retried; the real mapping is exercised by Phase 10-B's live flow.
 */
export function mapGatewayErrorToIntent(
  error: PaymentGatewayError
): FinalizeIntent {
  switch (error.code) {
    case "REQUEST_FAILED":
    case "TIMEOUT":
    case "INVALID_RESPONSE":
    case "VERIFY_FAILED":
      // Verification failing while the gateway had the money is a
      // Phase 10-B concern (retry verification before failing); for this
      // phase every transport failure safely resolves to CANCELLED.
      return { kind: "FAILURE", to: "CANCELLED" };
  }
}

// ── User-scoped read models ───────────────────────────────────────────

export type UserPaymentSummary = {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  method: string;
  provider: string;
  status: PaymentStatus;
  transactionId: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

/** All payments for one of the user's orders — scoped by ownership. */
export async function getUserOrderPayments(
  userId: string,
  orderId: string
): Promise<UserPaymentSummary[]> {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, orderNumber: true },
    });
    if (!order) return [];
    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });
    return payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      orderNumber: order.orderNumber,
      amount: p.amount,
      method: p.method,
      provider: p.provider,
      status: p.status,
      transactionId: p.transactionId,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
  } catch {
    return [];
  }
}

/** Single payment — only addressable through the owner's order. */
export async function getUserOrderPaymentById(
  userId: string,
  paymentId: string
): Promise<UserPaymentSummary | null> {
  try {
    const row = await prisma.payment.findFirst({
      where: { id: paymentId, order: { userId } },
      include: { order: { select: { orderNumber: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      amount: row.amount,
      method: row.method,
      provider: row.provider,
      status: row.status,
      transactionId: row.transactionId,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
    };
  } catch {
    return null;
  }
}
