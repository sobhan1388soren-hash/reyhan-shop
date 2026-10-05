"use server";

// Checkout server actions — thin, secure transport between the client UI
// and the server-authoritative validation/order modules.
// Every action re-derives the user from the signed session and never
// trusts client-submitted prices, totals, stock, or identifiers.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { validateCart } from "@/lib/cart/validate";
import {
  validateCheckoutFinal,
  CheckoutValidationError,
} from "@/lib/checkout/validate";
import { createOrderFromCheckout } from "@/lib/checkout/order";
import {
  normalizeDiscountCode,
  resolveSubmittedDiscountCode,
  DISCOUNT_STACK_MESSAGE,
} from "@/lib/checkout/discount";
import { resolveShippingMethod, calculateShippingCost } from "@/lib/checkout/shipping";
import { evaluateDiscountForCheckout } from "@/lib/discounts/service";
import { DISCOUNT_REJECT_MESSAGES } from "@/lib/discounts/rules";
import { sendOrderPlacedNotification } from "@/lib/notifications";
import type { CheckoutFormState } from "@/lib/checkout/types";
import type { CartValidationResult } from "@/lib/cart/types";

// ── Snapshot validation (page load / cart changes) ─────────────────────

export type CheckoutSnapshotOutcome =
  | { ok: true; cart: CartValidationResult }
  | { ok: false; error: string };

/**
 * Re-validate the cart server-side while the user fills the checkout form.
 * Mirrors the cart action — prices/stock facts come from the DB only.
 */
export async function validateCheckoutCartAction(
  entries: unknown
): Promise<CheckoutSnapshotOutcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const cart = await validateCart(entries);
    return { ok: true, cart };
  } catch {
    return {
      ok: false,
      error: "در حال حاضر امکان بررسی سبد خرید وجود ندارد. لطفاً دوباره تلاش کنید.",
    };
  }
}

// ── Discount preview (apply a code while filling the form) ─────────────

export type ApplyDiscountOutcome =
  | {
      ok: true;
      code: string;
      amount: number;
      freeShipping: boolean;
      totals: { subtotal: number; shippingCost: number; discountAmount: number; totalAmount: number };
      message: string | null;
    }
  | { ok: false; error: string };

const SESSION_EXPIRED_MESSAGE = "نشست شما منقضی شده است.";

/**
 * Apply (preview) a discount code against the user's current cart.
 *
 * Security model:
 *   - identity from the signed session only
 *   - the cart is re-validated server-side; the client subtotal is a wish
 *   - shipping cost (when a method is supplied) is resolved against
 *     server-known methods
 *   - the discount amount/eligibility is ALWAYS recomputed by the server
 *     engine — client-supplied amounts and totals are never read
 *
 * Applying a code consumes NO usage — usage is consumed only when the
 * order's payment succeeds (see payments/service + discounts/service).
 */
export async function applyCheckoutDiscountAction(input: {
  entries: unknown;
  code: unknown;
  shippingMethodId?: unknown;
}): Promise<ApplyDiscountOutcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_MESSAGE };

  // 1) Normalize the code — empty/hostile input gets a Persian error.
  const code = normalizeDiscountCode(input.code);
  if (!code) {
    return { ok: false, error: "کد تخفیف را وارد کنید." };
  }

  // 2) Validate the cart server-side — the subtotal drives eligibility.
  let cart: CartValidationResult;
  try {
    cart = await validateCart(input.entries);
  } catch {
    return {
      ok: false,
      error: "در حال حاضر امکان بررسی سبد خرید وجود ندارد. لطفاً دوباره تلاش کنید.",
    };
  }
  if (cart.items.length === 0 || cart.subtotal <= 0 || cart.purchasableCount === 0) {
    return {
      ok: false,
      error: "سبد خرید شما خالی است یا هیچ کالای قابل‌خریدی ندارد.",
    };
  }

  // 3) Shipping cost — only server-known methods are resolvable. When no
  //    method is supplied the preview assumes 0 (like the snapshot); the
  //    final validation recomputes with the selected method anyway.
  let shippingMethodCost = 0;
  if (input.shippingMethodId != null) {
    const shipping = resolveShippingMethod(input.shippingMethodId);
    if (!shipping.ok) {
      return { ok: false, error: shipping.error };
    }
    shippingMethodCost = calculateShippingCost(shipping.method);
  }

  // 4) Evaluate the discount fully server-side.
  let evaluated: Awaited<ReturnType<typeof evaluateDiscountForCheckout>>;
  try {
    evaluated = await evaluateDiscountForCheckout({
      userId: user.id,
      code,
      subtotal: cart.subtotal,
      shippingMethodCost,
    });
  } catch {
    return {
      ok: false,
      error: "در حال حاضر امکان بررسی کد تخفیف وجود ندارد. لطفاً دوباره تلاش کنید.",
    };
  }

  if (!evaluated.ok) {
    return { ok: false, error: DISCOUNT_REJECT_MESSAGES[evaluated.reason] };
  }

  // 5) Success — the server-computed preview (amount + totals) is returned;
  //    the client never supplies or overrides any of these numbers.
  return {
    ok: true,
    code: evaluated.discount.code,
    amount: evaluated.discount.amount,
    freeShipping: evaluated.discount.freeShipping,
    totals: evaluated.totals,
    message: null,
  };
}

// ── Final submission: validate → create order atomically ──────────────

/**
 * Final checkout submission. Runs the full server-side validation pass
 * (auth, cart items, prices, stock, address ownership, shipping, payment,
 * discount, totals) and, only if everything passes, creates the order +
 * items + payment + inventory writes in one transaction. On success the
 * guest cart is cleared by the client after redirect.
 */
export async function submitCheckout(
  _prev: CheckoutFormState,
  formData: FormData
): Promise<CheckoutFormState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "idle",
      error: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.",
    };
  }

  // Cart entries arrive as a JSON string field from the client storage.
  let cartEntries: unknown = [];
  const rawEntries = formData.get("cartEntries");
  if (typeof rawEntries === "string" && rawEntries.trim()) {
    try {
      cartEntries = JSON.parse(rawEntries);
    } catch {
      cartEntries = [];
    }
  }

  const addressId = formData.get("addressId");
  const shippingMethodId = formData.get("shippingMethodId");
  const paymentMethodId = formData.get("paymentMethodId");

  // Discount codes: every submitted field is collected so stacked codes
  // are detected; exactly one normalized code (or none) may proceed.
  const discountCodes = formData.getAll("discountCode");
  const resolvedDiscount = resolveSubmittedDiscountCode(discountCodes);
  if (!resolvedDiscount.ok) {
    return {
      status: "idle",
      error: DISCOUNT_STACK_MESSAGE,
      fieldErrors: { discountCode: DISCOUNT_STACK_MESSAGE },
    };
  }
  const discountCode = resolvedDiscount.code.present
    ? resolvedDiscount.code.code
    : "";

  let validated;
  try {
    validated = await validateCheckoutFinal({
      userId: user.id,
      cartEntries,
      addressId,
      shippingMethodId,
      paymentMethodId,
      discountCode,
    });
  } catch (e) {
    if (e instanceof CheckoutValidationError) {
      const redirectToCart =
        e.fieldErrors.cart === "empty" || e.fieldErrors.cart === "invalid_items";
      return {
        status: "idle",
        error: e.message,
        fieldErrors: e.fieldErrors,
        ...(redirectToCart ? { redirectToCart: true } : {}),
      };
    }
    const msg = e instanceof Error ? e.message : "";
    if (
      msg === "CHECKOUT_CART_UNAVAILABLE" ||
      msg === "CHECKOUT_ADDRESSES_UNAVAILABLE" ||
      msg === "CHECKOUT_ADDRESS_UNAVAILABLE"
    ) {
      return {
        status: "idle",
        error:
          "در حال حاضر امکان تکمیل سفارش وجود ندارد. اتصال فروشگاه برقرار نیست؛ لطفاً کمی بعد دوباره تلاش کنید.",
      };
    }
    return {
      status: "idle",
      error: "ثبت سفارش ممکن نشد. لطفاً دوباره تلاش کنید.",
    };
  }

  // Order creation — atomic transaction with in-transaction stock re-check.
  let order: { id: string; orderNumber: string };
  try {
    order = await createOrderFromCheckout(user.id, validated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CHECKOUT_STOCK_CHANGED") {
      return {
        status: "idle",
        error:
          "موجودی یکی از کالاهای سبد شما هم‌اکنون تغییر کرده است. لطفاً به سبد خرید بازگردید و تعدادها را بررسی کنید.",
        redirectToCart: true,
      };
    }
    if (msg === "CHECKOUT_ITEM_UNAVAILABLE") {
      return {
        status: "idle",
        error:
          "یکی از کالاهای سبد شما دیگر قابل عرضه نیست. لطفاً به سبد خرید بازگردید و اقلام را بررسی کنید.",
        redirectToCart: true,
      };
    }
    return {
      status: "idle",
      error:
        "ثبت سفارش در حال حاضر ممکن نشد. تغییر ناموفق بود و مبلغی از حساب شما کسر نشده است. لطفاً دوباره تلاش کنید.",
    };
  }

  // Success — hard redirect to the order page (PRG; the client also
  // clears the guest cart via the success route's own effect).
  // Best-effort SMS notification; failure does not affect the order.
  sendOrderPlacedNotification({ userId: user.id, orderNumber: order.orderNumber }).catch(
    (err: unknown) => console.error("[NOTIFICATION] order placed failed:", err)
  );

  redirect(`/checkout/success?orderId=${order.id}`);
}
