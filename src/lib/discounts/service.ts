// Discount service — server-only Prisma adapter for the pure discount
// domain (./rules), the checkout evaluation entry point, and the Phase
// 13–14 admin integration points.
//
// Security model (matches checkout/payments conventions):
//   - every evaluation re-derives the user from the signed session via
//     the DAL; the discount amount/type/totals NEVER come from the client
//   - code lookups are case-insensitive against stored rows
//   - usage consumption is atomic (guarded increment + unique usage row)
//     and runs ONLY on the payment-success transition inside the same
//     transaction as the payment/order writes
//   - public responses expose only display-safe fields — never limits,
//     counters, or administrative configuration
//
// No admin UI exists in Phase 12; the admin functions below are the clean
// service/domain integration points Phase 13–14 will call (role checks
// are enforced here server-side, not in the future UI).

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { calculateDiscountAmount } from "./rules.ts";
import type {
  DiscountRecord,
  DiscountEvaluateStore,
} from "./rules.ts";
import { evaluateDiscountForCart } from "./rules.ts";
import type { DiscountRejectReason } from "./rules.ts";
import { computeCheckoutTotals } from "@/lib/checkout/totals.ts";
import type { AppliedCheckoutDiscount } from "@/lib/checkout/types.ts";

// ── Record mappers ─────────────────────────────────────────────────────

type DiscountRow = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

function toDiscountRecord(row: DiscountRow): DiscountRecord {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    minOrderAmount: row.minOrderAmount,
    maxDiscountAmount: row.maxDiscountAmount,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    maxUsesPerUser: row.maxUsesPerUser,
    isActive: row.isActive,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

const DISCOUNT_SELECT = {
  id: true,
  code: true,
  type: true,
  value: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  maxUses: true,
  usedCount: true,
  maxUsesPerUser: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
} satisfies Prisma.DiscountSelect;

// ── Prisma evaluation store adapter ────────────────────────────────────

export const prismaDiscountEvaluateStore: DiscountEvaluateStore = {
  async findDiscountByCode(code) {
    // Case-insensitive match: the UI normalizes to the upper-case key;
    // Postgres `mode: "insensitive"` covers every stored casing.
    const row = await prisma.discount.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
      select: DISCOUNT_SELECT,
    });
    return row ? toDiscountRecord(row) : null;
  },

  async countUserUsages(discountId, userId) {
    return prisma.discountUsage.count({ where: { discountId, userId } });
  },
};

// ── Checkout evaluation (public entry point) ────────────────────────────

/**
 * Evaluate a discount code for a user's live cart and compute the
 * authoritative totals. The ONLY production entry point used by checkout
 * (preview action + final validation). Applying a code consumes nothing.
 */
export async function evaluateDiscountForCheckout(input: {
  userId: string;
  code: string;
  /** Server-validated cart subtotal in Rial. */
  subtotal: number;
  /** Resolved shipping cost in Rial (server-known method). */
  shippingMethodCost: number;
  now?: Date;
}): Promise<
  | {
      ok: true;
      discount: AppliedCheckoutDiscount;
      totals: ReturnType<typeof computeCheckoutTotals>;
    }
  | { ok: false; reason: DiscountRejectReason }
> {
  const outcome = await evaluateDiscountForCart(
    prismaDiscountEvaluateStore,
    {
      userId: input.userId,
      code: input.code,
      subtotal: input.subtotal,
      now: input.now,
    }
  );
  if (!outcome.ok) return { ok: false, reason: outcome.reason };

  const { discount } = outcome;
  const totals = computeCheckoutTotals({
    cart: { subtotal: input.subtotal },
    shippingMethodCost: input.shippingMethodCost,
    discountAmount: discount.amount,
    freeShipping: discount.freeShipping,
  });

  return {
    ok: true,
    discount: {
      discountId: discount.discountId,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      amount: discount.amount,
      freeShipping: discount.freeShipping,
    },
    totals,
  };
}

// Re-export the reject reason type for callers mapping engine outcomes.
export type { DiscountRejectReason } from "./rules.ts";

// ── Usage consumption (payment success path) ───────────────────────────

/**
 * Consume the discount usage of a paid order, called INSIDE the payment
 * finalization transaction (payments/service applies this after the
 * guarded payment+order success writes). The order's own discount
 * snapshot (discountId + userId) is re-read from the row — no discount
 * facts come from the caller's input. The unique [discountId, orderId]
 * row plus the guarded usedCount increment make concurrent successes
 * safe: only the first may insert; duplicates are idempotent no-ops.
 */
export async function consumeDiscountUsageInTx(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<"APPLIED" | "ALREADY_USED" | "LIMIT_REACHED" | "SKIPPED"> {
  const snapshot = await tx.order.findUnique({
    where: { id: orderId },
    select: { discountId: true, userId: true },
  });
  if (!snapshot?.discountId) return "SKIPPED";

  const discount = await tx.discount.findUnique({
    where: { id: snapshot.discountId },
    select: { maxUses: true, usedCount: true },
  });
  if (!discount) return "SKIPPED";

  // Idempotency: this order may already have consumed its usage.
  const existing = await tx.discountUsage.findUnique({
    where: { discountId_orderId: { discountId: snapshot.discountId, orderId } },
    select: { id: true },
  });
  if (existing) return "ALREADY_USED";

  // Global capacity — the guarded increment below re-checks under the
  // write so concurrent consumers can never exceed maxUses.
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    return "LIMIT_REACHED";
  }

  // Create the usage row FIRST: the unique constraint is the hard guard
  // against duplicate consumption for this order.
  await tx.discountUsage.create({
    data: {
      discountId: snapshot.discountId,
      orderId,
      userId: snapshot.userId,
    },
    select: { id: true },
  });

  // Guarded counter increment — only while capacity remains. A lost
  // capacity race throws so the caller's transaction rolls back (a paid
  // order either consumes its discount or nothing is written).
  const updated = await tx.discount.updateMany({
    where:
      discount.maxUses !== null
        ? { id: snapshot.discountId, usedCount: { lt: discount.maxUses } }
        : { id: snapshot.discountId },
    data: { usedCount: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new Error("DISCOUNT_CONSUME_CAPACITY_LOST");
  }

  return "APPLIED";
}

// ── Phase 13–14 admin integration points (service layer only, no UI) ───
//
// Every function re-resolves the caller's role from the session-derived
// user row — the future admin UI never supplies authorization facts.

export type DiscountAdminInput = {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
};

function canManageDiscounts(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "STAFF";
}

/** Create a discount (Phase 13–14 calls this; role enforced server-side). */
export async function createDiscount(
  actor: { id: string; role: string },
  input: DiscountAdminInput
): Promise<
  | { ok: true; discount: { id: string; code: string } }
  | { ok: false; error: "FORBIDDEN" | "INVALID_INPUT" | "DUPLICATE_CODE" }
> {
  if (!canManageDiscounts(actor)) return { ok: false, error: "FORBIDDEN" };

  const code = input.code?.trim();
  if (!code || code.length > 64) return { ok: false, error: "INVALID_INPUT" };
  if (input.type === "PERCENTAGE" && (input.value < 1 || input.value > 100)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  if (input.type === "FIXED_AMOUNT" && input.value <= 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  if (input.type === "FREE_SHIPPING" && input.value !== 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  try {
    const discount = await prisma.discount.create({
      data: {
        code,
        type: input.type,
        value: input.value,
        minOrderAmount: input.minOrderAmount ?? null,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
        maxUses: input.maxUses ?? null,
        maxUsesPerUser: input.maxUsesPerUser ?? 1,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        isActive: input.isActive ?? true,
      },
      select: { id: true, code: true },
    });
    return { ok: true, discount };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "DUPLICATE_CODE" };
    }
    throw e;
  }
}

/** Edit a discount's mutable rules (Phase 13–14; role enforced here). */
export async function updateDiscount(
  actor: { id: string; role: string },
  discountId: string,
  input: Partial<DiscountAdminInput>
): Promise<
  | { ok: true; discount: { id: string } }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "DUPLICATE_CODE" | "INVALID_INPUT" }
> {
  if (!canManageDiscounts(actor)) return { ok: false, error: "FORBIDDEN" };
  try {
    if (input.code != null) {
      const code = input.code.trim();
      if (!code || code.length > 64) return { ok: false, error: "INVALID_INPUT" };
      input.code = code;
    }
    const discount = await prisma.discount.update({
      where: { id: discountId },
      data: input,
      select: { id: true },
    });
    return { ok: true, discount };
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return { ok: false, error: "NOT_FOUND" };
    }
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "DUPLICATE_CODE" };
    }
    throw e;
  }
}

/** Activate/deactivate (Phase 13–14; role enforced here). */
export async function setDiscountActive(
  actor: { id: string; role: string },
  discountId: string,
  isActive: boolean
): Promise<
  { ok: true; discount: { id: string; isActive: boolean } }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" }
> {
  if (!canManageDiscounts(actor)) return { ok: false, error: "FORBIDDEN" };
  try {
    const discount = await prisma.discount.update({
      where: { id: discountId },
      data: { isActive },
      select: { id: true, isActive: true },
    });
    return { ok: true, discount };
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return { ok: false, error: "NOT_FOUND" };
    }
    throw e;
  }
}

/** Usage overview for the admin console (Phase 13–14; role enforced). */
export async function getDiscountUsage(
  actor: { id: string; role: string },
  discountId: string
): Promise<
  | {
      ok: true;
      usage: {
        usedCount: number;
        maxUses: number | null;
        maxUsesPerUser: number | null;
        recentUsages: { id: string; usedAt: Date; orderId: string | null }[];
      };
    }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" }
> {
  if (!canManageDiscounts(actor)) return { ok: false, error: "FORBIDDEN" };
  const discount = await prisma.discount.findUnique({
    where: { id: discountId },
    select: {
      usedCount: true,
      maxUses: true,
      maxUsesPerUser: true,
      usages: {
        orderBy: { usedAt: "desc" },
        take: 50,
        select: { id: true, usedAt: true, orderId: true },
      },
    },
  });
  if (!discount) return { ok: false, error: "NOT_FOUND" };
  return {
    ok: true,
    usage: {
      usedCount: discount.usedCount,
      maxUses: discount.maxUses,
      maxUsesPerUser: discount.maxUsesPerUser,
      recentUsages: discount.usages.map((u) => ({
        id: u.id,
        usedAt: u.usedAt,
        orderId: u.orderId,
      })),
    },
  };
}

// Keep the pure re-export available for callers that need calculation only.
export { calculateDiscountAmount };
