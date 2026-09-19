// Pure checkout calculations — no server-only imports, no Prisma, no Next.
// Shared by the server validation pipeline and the unit tests.

import type { CartValidationResult } from "@/lib/cart/types";
import type { CheckoutTotals } from "./types";

/**
 * Server-computed order totals. Inputs come exclusively from prior
 * server-side validation (live DB prices, known shipping methods, the
 * discount engine). Guards ensure totals can never be inflated or
 * exploited via negative or oversized values.
 *
 * Free-shipping discounts waive the shipping cost entirely: the effective
 * shipping cost is 0 while Order.shippingCost still records the resolved
 * method cost (the discount amount itself stays 0 for FREE_SHIPPING).
 */
export function computeCheckoutTotals(input: {
  cart: Pick<CartValidationResult, "subtotal">;
  shippingMethodCost: number;
  discountAmount: number;
  /** True when a FREE_SHIPPING discount is applied — shipping becomes 0. */
  freeShipping?: boolean;
}): CheckoutTotals {
  const subtotal = Math.max(0, Math.round(input.cart.subtotal));
  const resolvedShippingCost = Math.max(0, Math.round(input.shippingMethodCost));
  const shippingCost = input.freeShipping ? 0 : resolvedShippingCost;
  const discountAmount = Math.max(
    0,
    Math.min(Math.round(input.discountAmount), subtotal)
  );
  const totalAmount = subtotal + shippingCost - discountAmount;
  return { subtotal, shippingCost, discountAmount, totalAmount };
}

/** Human-readable order number, e.g. RY-20260912-4821 (date-based, sortable). */
export function generateOrderNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RY-${y}${m}${d}-${rand}`;
}
