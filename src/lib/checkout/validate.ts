// Server-side checkout validation — the single authoritative source for
// every value that enters an order. Everything of value is re-derived from
// the database at finalization time:
//   - user identity        → signed session (DAL), never a client field
//   - cart items           → re-validated against live catalog state
//   - unit prices/totals   → current DB prices; client snapshots ignored
//   - stock                → live inventory; quantities re-clamped
//   - address ownership    → userId-scoped lookup, foreign ids rejected
//   - shipping/payment     → resolved against server-known methods only
//   - discount             → Phase 12 engine; full server-side rule check
//                            + amount recomputation from the live subtotal

import "server-only";
import prisma from "@/lib/prisma";
import { validateCart } from "@/lib/cart/validate";
import type { CartValidationResult } from "@/lib/cart/types";
import { resolveShippingMethod, calculateShippingCost } from "./shipping";
import { resolvePaymentMethod } from "./payment";
import { normalizeDiscountCode } from "./discount";
import { computeCheckoutTotals } from "./totals";
import { evaluateDiscountForCheckout } from "@/lib/discounts/service";
import { NO_DISCOUNT_STATE } from "./discount";
import { DISCOUNT_REJECT_MESSAGES } from "@/lib/discounts/rules";
import type {
  AppliedCheckoutDiscount,
  CheckoutAddress,
  CheckoutSnapshot,
  CheckoutTotals,
} from "./types";

export class CheckoutValidationError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "CheckoutValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Load the user's saved addresses — always scoped to the session user. */
export async function getCheckoutAddresses(userId: string): Promise<CheckoutAddress[]> {
  try {
    const rows = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((a) => ({
      id: a.id,
      recipientName: a.recipientName,
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalCode: a.postalCode,
      addressLine: a.addressLine,
      isDefault: a.isDefault,
    }));
  } catch {
    throw new Error("CHECKOUT_ADDRESSES_UNAVAILABLE");
  }
}

/**
 * Authoritative address selection. The address id arrives from the client
 * but is only accepted when it belongs to the session user — users can
 * never ship to another account's address.
 */
export async function resolveCheckoutAddress(
  userId: string,
  addressId: unknown
): Promise<CheckoutAddress> {
  if (typeof addressId !== "string" || !addressId.trim()) {
    throw new CheckoutValidationError("نشانی ارسال را انتخاب کنید.", {
      addressId: "نشانی ارسال را انتخاب کنید.",
    });
  }
  try {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new CheckoutValidationError(
        "نشانی انتخاب‌شده یافت نشد. نشانی دیگری انتخاب کنید.",
        { addressId: "نشانی انتخاب‌شده یافت نشد." }
      );
    }
    return {
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      postalCode: address.postalCode,
      addressLine: address.addressLine,
      isDefault: address.isDefault,
    };
  } catch (e) {
    if (e instanceof CheckoutValidationError) throw e;
    throw new Error("CHECKOUT_ADDRESS_UNAVAILABLE");
  }
}

// Totals computation lives in ./totals (pure, testable without a DB).

export type FinalValidationInput = {
  userId: string;
  /** Raw guest-cart entries from the client — wishes, never facts. */
  cartEntries: unknown;
  addressId: unknown;
  shippingMethodId: unknown;
  paymentMethodId: unknown;
  discountCode: unknown;
};

export type FinalValidationResult = {
  cart: CartValidationResult;
  address: CheckoutAddress;
  shippingMethodId: string;
  shippingCost: number;
  paymentMethodId: "ONLINE";
  /** Server-validated applied discount; null when no code was applied. */
  discount: AppliedCheckoutDiscount | null;
  totals: CheckoutTotals;
};

/**
 * Full server-side validation run immediately before order creation.
 * Throws CheckoutValidationError for user-correctable problems and plain
 * Error("CHECKOUT_…_UNAVAILABLE") for infrastructure failures — the caller
 * distinguishes them for the UI.
 */
export async function validateCheckoutFinal(
  input: FinalValidationInput
): Promise<FinalValidationResult> {
  // 1) Cart — re-validated against live DB prices/stock; client totals ignored.
  let cart: CartValidationResult;
  try {
    cart = await validateCart(input.cartEntries);
  } catch {
    throw new Error("CHECKOUT_CART_UNAVAILABLE");
  }

  if (cart.items.length === 0 || cart.purchasableCount === 0) {
    throw new CheckoutValidationError(
      "سبد خرید شما خالی است یا هیچ کالای قابل‌خریدی ندارد.",
      { cart: "empty" }
    );
  }
  if (!cart.allPurchasable || cart.subtotal <= 0) {
    throw new CheckoutValidationError(
      "برخی از کالاهای سبد خرید نامعتبر شده‌اند (قیمت/موجودی تغییر کرده یا کالا حذف شده است). لطفاً به سبد خرید بازگردید و وضعیت اقلام را بررسی کنید.",
      { cart: "invalid_items" }
    );
  }

  // 2) Address — ownership enforced server-side.
  const address = await resolveCheckoutAddress(input.userId, input.addressId);

  // 3) Shipping — only server-known methods; cost is server-authoritative.
  const shipping = resolveShippingMethod(input.shippingMethodId);
  if (!shipping.ok) {
    throw new CheckoutValidationError(shipping.error, {
      shippingMethod: shipping.error,
    });
  }
  const shippingCost = calculateShippingCost(shipping.method);

  // 4) Payment — provider-agnostic; only server-known methods.
  const payment = resolvePaymentMethod(input.paymentMethodId);
  if (!payment.ok) {
    throw new CheckoutValidationError(payment.error, {
      paymentMethod: payment.error,
    });
  }

  // 5) Discount — Phase 12 engine: full rule validation + amount
  //    recomputation from the live subtotal. The client code is only a
  //    *wish*; type, value, amount, and eligibility never come from it.
  let discount: AppliedCheckoutDiscount | null = null;
  const normalizedCode = normalizeDiscountCode(input.discountCode);
  if (normalizedCode) {
    const evaluated = await evaluateDiscountForCheckout({
      userId: input.userId,
      code: normalizedCode,
      subtotal: cart.subtotal,
      shippingMethodCost: shippingCost,
    });
    if (!evaluated.ok) {
      throw new CheckoutValidationError(
        DISCOUNT_REJECT_MESSAGES[evaluated.reason],
        { discountCode: evaluated.reason }
      );
    }
    discount = evaluated.discount;
  }

  // 6) Totals — computed once, server-side, from the values above
  //    (free-shipping discounts waive the shipping cost).
  const totals = computeCheckoutTotals({
    cart,
    shippingMethodCost: shippingCost,
    discountAmount: discount?.amount ?? 0,
    freeShipping: discount?.freeShipping ?? false,
  });

  return {
    cart,
    address,
    shippingMethodId: shipping.method.id,
    shippingCost,
    paymentMethodId: payment.method.id,
    discount,
    totals,
  };
}

/** Assemble the page-level snapshot for the checkout UI. */
export async function getCheckoutSnapshot(input: {
  userId: string;
  cartEntries: unknown;
}): Promise<CheckoutSnapshot> {
  const [addresses, cart, shippingMethods, paymentMethods] = await Promise.all([
    getCheckoutAddresses(input.userId),
    validateCart(input.cartEntries).catch(() => null),
    Promise.resolve(getShippingMethodsServer()),
    Promise.resolve(getPaymentMethodsServer()),
  ]);

  const validatedCart =
    cart ??
    ({
      items: [],
      subtotal: 0,
      totalCount: 0,
      purchasableCount: 0,
      allPurchasable: true,
      hasIssues: false,
    } as CartValidationResult);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const totals = computeCheckoutTotals({
    cart: validatedCart,
    shippingMethodCost: 0, // snapshot display only; final cost computed at submission
    discountAmount: 0,
  });

  return {
    cart: validatedCart,
    addresses,
    shippingMethods,
    paymentMethods,
    discount: NO_DISCOUNT_STATE, // a code is applied per-session by the user
    totals,
    defaultAddressId: defaultAddress?.id ?? null,
  };
}

// Local re-exports keep this module server-only while the option lists
// themselves stay importable by client code from their own modules.
import { getShippingMethods as getShippingMethodsServer } from "./shipping";
import { getPaymentMethods as getPaymentMethodsServer } from "./payment";
