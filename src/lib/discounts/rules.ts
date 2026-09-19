// Discount domain — pure validation, calculation, and lifecycle rules.
//
// This module is deliberately DB-free and server-only-free so it is unit-
// testable in a bare `node --test` process (mirroring checkout/payments).
// The Prisma-backed adapter lives in ./service; checkout validation and
// the payment finalization adapter call into it.
//
// Security model:
//   - Every eligibility decision (code existence, dates, active status,
//     usage limits, minimum order amount, per-user caps) is made HERE on
//     server-provided data; client input never reaches these functions
//     beyond the raw code string (already normalized by checkout/discount).
//   - Amounts are always recomputed from the live order/cart state; a
//     client-submitted discount amount or total is never an input.
//   - Usage consumption happens ONLY on the payment-success path and only
//     once per order (unique [discountId, orderId]) — applying a code in
//     checkout never consumes anything.
//
// All monetary values are Int Rial, matching the schema.

// ── Reject reasons (stable machine codes) ──────────────────────────────

export type DiscountRejectReason =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_YET_ACTIVE"
  | "EXPIRED"
  | "MIN_ORDER_NOT_MET"
  | "GLOBAL_LIMIT_REACHED"
  | "USER_LIMIT_REACHED";

/** Persian/RTL rejection copy keyed by reason (checkout UI surfaces it). */
export const DISCOUNT_REJECT_MESSAGES: Readonly<
  Record<DiscountRejectReason, string>
> = {
  INVALID_REQUEST: "کد تخفیف را به شکل صحیح وارد کنید.",
  NOT_FOUND: "کد تخفیف واردشده معتبر نیست یا وجود ندارد.",
  INACTIVE: "این کد تخفیف فعال نیست.",
  NOT_YET_ACTIVE: "زمان استفاده از این کد تخفیف هنوز آغاز نشده است.",
  EXPIRED: "مدت اعتبار این کد تخفیف به پایان رسیده است.",
  MIN_ORDER_NOT_MET: "مبلغ سفارش برای استفاده از این کد تخفیف کافی نیست.",
  GLOBAL_LIMIT_REACHED: "ظرفیت استفاده از این کد تخفیف به پایان رسیده است.",
  USER_LIMIT_REACHED: "شما پیش‌تر از این کد تخفیف استفاده کرده‌اید.",
};

// ── Domain records ─────────────────────────────────────────────────────

/** Server-read view of a Discount row (mutable rule configuration). */
export type DiscountRecord = {
  id: string;
  /** Stored (already unique) code — lookup is case-insensitive. */
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

/** Server-computed context the discount is evaluated against. */
export type DiscountOrderContext = {
  /** Live cart subtotal in Rial (server-validated). */
  subtotal: number;
  /** Count of this user's CONSUMED usages of the discount (paid orders). */
  userUsedCount: number;
};

// ── Pure helpers ───────────────────────────────────────────────────────

export function isValidDiscountAmount(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= 1_000_000_000_000
  );
}

/**
 * Validate a discount record against time/active/limit/minimum rules.
 * `now` is injected so tests are deterministic.
 */
export function validateDiscountRule(
  record: DiscountRecord,
  context: DiscountOrderContext,
  now: Date
): { ok: true } | { ok: false; reason: DiscountRejectReason } {
  if (!record.isActive) return { ok: false, reason: "INACTIVE" };
  if (record.startsAt && now.getTime() < record.startsAt.getTime()) {
    return { ok: false, reason: "NOT_YET_ACTIVE" };
  }
  if (record.endsAt && now.getTime() > record.endsAt.getTime()) {
    return { ok: false, reason: "EXPIRED" };
  }
  if (record.maxUses !== null && record.usedCount >= record.maxUses) {
    return { ok: false, reason: "GLOBAL_LIMIT_REACHED" };
  }
  if (
    record.minOrderAmount !== null &&
    context.subtotal < record.minOrderAmount
  ) {
    return { ok: false, reason: "MIN_ORDER_NOT_MET" };
  }
  if (
    record.maxUsesPerUser !== null &&
    context.userUsedCount >= record.maxUsesPerUser
  ) {
    return { ok: false, reason: "USER_LIMIT_REACHED" };
  }
  return { ok: true };
}

/**
 * Server-authoritative discount calculation.
 *
 *   - PERCENTAGE: value% of the subtotal, capped by the optional
 *     maxDiscountAmount, never negative, never above the subtotal.
 *   - FIXED_AMOUNT: the configured amount, never above the subtotal
 *     (a fixed discount may never reduce the order below zero).
 *   - FREE_SHIPPING: no product discount; it waives the shipping cost.
 *     The snapshot value stored on the order is the rule's raw value.
 */
export function calculateDiscountAmount(
  record: Pick<
    DiscountRecord,
    "type" | "value" | "maxDiscountAmount"
  >,
  subtotal: number
): number {
  if (!isValidDiscountAmount(subtotal) || subtotal <= 0) return 0;

  switch (record.type) {
    case "PERCENTAGE": {
      if (
        !Number.isFinite(record.value) ||
        record.value <= 0 ||
        record.value > 100
      ) {
        return 0;
      }
      const raw = Math.round((subtotal * record.value) / 100);
      const capped =
        record.maxDiscountAmount != null &&
        isValidDiscountAmount(record.maxDiscountAmount)
          ? Math.min(raw, record.maxDiscountAmount)
          : raw;
      return Math.max(0, Math.min(capped, subtotal));
    }
    case "FIXED_AMOUNT": {
      if (!isValidDiscountAmount(record.value) || record.value <= 0) return 0;
      return Math.min(record.value, subtotal);
    }
    case "FREE_SHIPPING":
      return 0;
  }
}

// ── Evaluation flow (checkout apply/preview + final validation) ────────

/** Store port for the evaluation flow; the Prisma adapter lives in ./service. */
export interface DiscountEvaluateStore {
  /** Case-insensitive code lookup; null when the code does not exist. */
  findDiscountByCode(code: string): Promise<DiscountRecord | null>;
  /** Consumed (paid-order) usage count for this user + discount. */
  countUserUsages(discountId: string, userId: string): Promise<number>;
}

export type AppliedDiscountView = {
  discountId: string;
  code: string;
  type: DiscountRecord["type"];
  value: number;
  amount: number;
  freeShipping: boolean;
};

export type EvaluateDiscountOutcome =
  | { ok: true; discount: AppliedDiscountView }
  | { ok: false; reason: DiscountRejectReason };

/**
 * Evaluate a normalized discount code for a user's current cart.
 *
 * Full server-side rule check + amount computation. Applying a code here
 * consumes NOTHING — usage is recorded only when the order's payment
 * succeeds (see consumeDiscountForPaidOrder / the Prisma adapter).
 */
export async function evaluateDiscountForCart(
  store: DiscountEvaluateStore,
  input: {
    userId: string;
    /** Normalized display form (see checkout/discount.normalizeDiscountCode). */
    code: string;
    subtotal: number;
    now?: Date;
  }
): Promise<EvaluateDiscountOutcome> {
  const now = input.now ?? new Date();
  if (!input.code) return { ok: false, reason: "INVALID_REQUEST" };

  const record = await store.findDiscountByCode(input.code);
  if (!record) return { ok: false, reason: "NOT_FOUND" };

  const userUsedCount = await store.countUserUsages(record.id, input.userId);

  const verdict = validateDiscountRule(
    record,
    { subtotal: input.subtotal, userUsedCount },
    now
  );
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const amount = calculateDiscountAmount(record, input.subtotal);

  return {
    ok: true,
    discount: {
      discountId: record.id,
      code: record.code,
      type: record.type,
      value: record.value,
      amount,
      freeShipping: record.type === "FREE_SHIPPING",
    },
  };
}

// ── Consumption flow (payment success only) ─────────────────────────────

/**
 * Store port for usage consumption. The Prisma adapter implements both
 * methods inside ONE transaction with a guarded usedCount increment and a
 * unique [discountId, orderId] usage row, so concurrent winners can never
 * push the counters past their limits.
 */
export interface DiscountConsumeStore {
  /** The discount snapshot stored on the order at creation (null = none). */
  findOrderDiscountSnapshot(
    orderId: string
  ): Promise<{
    discountId: string;
    userId: string | null;
    type: DiscountRecord["type"];
    value: number;
  } | null>;

  /**
   * Atomically: insert the [discountId, orderId] usage row (unique guard)
   * AND increment usedCount ONLY while capacity remains. Returns "LIMIT_REACHED"
   * when the global cap is exhausted; "ALREADY_USED" when this order already
   * consumed it (idempotent); "APPLIED" on first consumption.
   */
  consumeDiscountUsage(input: {
    discountId: string;
    orderId: string;
    userId: string | null;
  }): Promise<"APPLIED" | "ALREADY_USED" | "LIMIT_REACHED" | "NO_CAPACITY">;
}

/**
 * Consume the discount usage of a PAID order — called by the payment
 * finalization path exactly once per paid order. Idempotent: a duplicate
 * success delivery must not double-count. A rejected consumption never
 * fails the already-completed payment transition.
 */
export async function consumeDiscountForPaidOrder(
  store: DiscountConsumeStore,
  orderId: string
): Promise<
  "APPLIED" | "ALREADY_USED" | "LIMIT_REACHED" | "NO_CAPACITY" | "SKIPPED"
> {
  const snapshot = await store.findOrderDiscountSnapshot(orderId);
  if (!snapshot) return "SKIPPED";

  return store.consumeDiscountUsage({
    discountId: snapshot.discountId,
    orderId,
    userId: snapshot.userId,
  });
}
