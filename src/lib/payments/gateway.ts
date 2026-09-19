// Provider-agnostic payment gateway contract.
//
// The application depends ONLY on this interface — no module outside the
// gateway adapters may mention a specific provider. Concrete adapters
// (e.g. ZarinPal) implement it; the registry (./registry) selects one.
//
// Phase 10-A: interface + skeletons only. No adapter performs a real
// gateway call yet — implementations throw PAYMENT_GATEWAY_NOT_IMPLEMENTED
// until Phase 10-B wires live request/verify logic.

/** Amounts are Int Rial throughout — the same unit the Order row stores. */
export type GatewayPaymentRequest = {
  /** Internal Payment row id — adapters echo it for idempotent bookkeeping. */
  paymentId: string;
  /** Server-derived amount (order.totalAmount) — never client-supplied. */
  amount: number;
  description: string;
  callbackUrl: string;
};

export type GatewayPaymentRequestResult = {
  /** Gateway authority/token to persist on the Payment row. */
  authority: string;
  redirectUrl: string;
};

export type GatewayVerificationRequest = {
  paymentId: string;
  amount: number;
  authority: string;
};

export type GatewayVerificationResult = {
  refId: string;
  meta?: Record<string, unknown>;
};

/** Stable machine code for "adapter exists but is not wired yet". */
export class PaymentGatewayNotImplementedError extends Error {
  provider: string;
  constructor(provider: string) {
    super(`PAYMENT_GATEWAY_NOT_IMPLEMENTED:${provider}`);
    this.name = "PaymentGatewayNotImplementedError";
    this.provider = provider;
  }
}

/** Stable machine code for adapter-level runtime failures (Phase 10-B). */
export class PaymentGatewayError extends Error {
  code: "REQUEST_FAILED" | "VERIFY_FAILED" | "TIMEOUT" | "INVALID_RESPONSE";
  constructor(code: PaymentGatewayError["code"], detail?: string) {
    super(`PAYMENT_GATEWAY_${code}:${detail ?? ""}`);
    this.name = "PaymentGatewayError";
    this.code = code;
  }
}

export interface PaymentGateway {
  /** Stable provider key — matches the Prisma PaymentProvider enum. */
  readonly provider: "ZARINPAL" | "MELLAT" | "PASARGAD" | "MANUAL" | "OTHER";

  /** Ask the provider to open a payment session (Phase 10-B). */
  requestPayment(
    input: GatewayPaymentRequest
  ): Promise<GatewayPaymentRequestResult>;

  /** Verify a provider callback against the provider (Phase 10-B). */
  verifyPayment(
    input: GatewayVerificationRequest
  ): Promise<GatewayVerificationResult>;
}
