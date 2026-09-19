// Gateway registry — the ONLY place a concrete provider is chosen.
// Swapping/adding providers means changing this module alone; every other
// payment module stays provider-agnostic.

import type { PaymentGateway } from "./gateway.ts";
import { ZarinPalGateway } from "./zarinpal.ts";

export type PaymentProviderId = PaymentGateway["provider"];

let overrideForTests: PaymentGateway | null = null;

/** Test hook — unit tests inject a fake; production code never calls this. */
export function setGatewayForTests(gateway: PaymentGateway | null): void {
  overrideForTests = gateway;
}

export function getPaymentGateway(): PaymentGateway {
  if (overrideForTests) return overrideForTests;
  // Phase 10-A: ZarinPal is the planned provider. The skeleton throws
  // PAYMENT_GATEWAY_NOT_IMPLEMENTED on use; nothing calls it in production
  // until Phase 10-B wires the live flow.
  return new ZarinPalGateway();
}
