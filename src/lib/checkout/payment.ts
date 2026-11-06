// Payment methods — provider-agnostic abstraction.
// No gateway is approved yet (integration belongs to Phase 10). Online
// payment is the only representable method; the Payment row is created in
// PENDING state and no gateway call is ever made in this phase.

import type { PaymentMethodOption } from "./types";

/**
 * Available payment methods for checkout.
 *
 * ZarinPal integration belongs to Phase 10 and is not yet active.
 * ONLINE is kept in the list (never removed) so the UI and validation
 * remain structurally correct when the gateway is approved. It is
 * marked non-selectable until that approval.
 */
export function getPaymentMethods(): PaymentMethodOption[] {
  return [
    {
      id: "ONLINE",
      title: "پرداخت اینترنتی",
      description:
        "پرداخت اینترنتی از طریق درگاه زرین‌پال — این گزینه به‌زودی فعال می‌شود.",
      selectable: false,
    },
  ];
}

/**
 * Resolve a payment method id submitted by the client to a server-known
 * method. Unknown ids are rejected server-side.
 */
export function resolvePaymentMethod(
  methodId: unknown
): { ok: true; method: PaymentMethodOption } | { ok: false; error: string } {
  if (typeof methodId !== "string" || !methodId.trim()) {
    return { ok: false, error: "روش پرداخت را انتخاب کنید." };
  }
  const method = getPaymentMethods().find((m) => m.id === methodId && m.selectable);
  if (!method) {
    return { ok: false, error: "روش پرداخت انتخابی معتبر نیست." };
  }
  return { ok: true, method };
}
