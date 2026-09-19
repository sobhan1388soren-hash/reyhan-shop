// Shipping methods — modular, provider-agnostic abstraction.
// No courier/provider is approved yet; nothing here may hard-code a company
// or a final price policy. Phase "Shipping" (future) will replace the single
// placeholder method with real provider data behind the same interface.

import type { ShippingMethodOption } from "./types";

/**
 * Available shipping methods for the current cart.
 *
 * Placeholder architecture (Phase 9): exactly one unspecified standard
 * method with an undetermined cost. When a provider is approved, this
 * function becomes async and returns real, priced, selectable methods —
 * the UI and order pipeline already consume the array shape.
 */
export function getShippingMethods(): ShippingMethodOption[] {
  return [
    {
      id: "STANDARD",
      title: "ارسال استاندارد",
      description:
        "ارسال سفارش با روش استاندارد فروشگاه — جزئیات و هزینه نهایی پس از تکمیل اطلاعات ارسال، در مرحله پرداخت اعلام می‌شود.",
      cost: null,
      selectable: true,
    },
  ];
}

/**
 * Resolve a shipping method id submitted by the client to a server-known
 * method. Unknown or unapproved ids are rejected — the client never decides
 * what methods exist.
 */
export function resolveShippingMethod(
  methodId: unknown
): { ok: true; method: ShippingMethodOption } | { ok: false; error: string } {
  if (typeof methodId !== "string" || !methodId.trim()) {
    return { ok: false, error: "روش ارسال را انتخاب کنید." };
  }
  const method = getShippingMethods().find((m) => m.id === methodId && m.selectable);
  if (!method) {
    return { ok: false, error: "روش ارسال انتخابی معتبر نیست." };
  }
  return { ok: true, method };
}

/**
 * Authoritative shipping cost for an order.
 *
 * Placeholder (Phase 9): 0 Rial — no shipping policy is approved, so no
 * invented cost may be charged. The order pipeline still records the value
 * in Order.shippingCost, ready for the real calculation.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateShippingCost(_method: ShippingMethodOption): number {
  return 0;
}
