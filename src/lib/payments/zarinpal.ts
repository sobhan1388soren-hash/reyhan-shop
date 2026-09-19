// ZarinPal gateway adapter — LIVE implementation (Phase 10-B).
//
// Implements the provider-agnostic PaymentGateway contract against the
// ZarinPal v4 REST API. ALL ZarinPal knowledge (endpoints, error codes,
// authority format, sandbox hosts, callback param names) lives in this
// file alone; every other payment module stays provider-agnostic.
//
// Security: merchantId is server-side only, never logged, never shipped
// to the client. Transport failures map to the stable PaymentGatewayError
// taxonomy (REQUEST_FAILED / VERIFY_FAILED / TIMEOUT / INVALID_RESPONSE)
// so the finalization engine never sees provider internals.

import type {
  GatewayPaymentRequest,
  GatewayPaymentRequestResult,
  GatewayVerificationRequest,
  GatewayVerificationResult,
  PaymentGateway,
} from "./gateway.ts";
import { PaymentGatewayError } from "./gateway.ts";
import { isValidServerAmount } from "./amount.ts";
import { isValidGatewayRef } from "./engine.ts";

export const ZARINPAL_PROVIDER_ID = "ZARINPAL" as const;

/** Hosted checkout pages — {authority} is appended by the live flow. */
export const ZARINPAL_PAY_ENDPOINT = "https://www.zarinpal.com/pg/StartPay" as const;
export const ZARINPAL_SANDBOX_PAY_ENDPOINT =
  "https://sandbox.zarinpal.com/pg/StartPay" as const;

/** ZarinPal v4 REST endpoints (sandbox swaps the host only). */
const ZARINPAL_API_BASE = "https://payment.zarinpal.com";
const ZARINPAL_SANDBOX_API_BASE = "https://sandbox.payment.zarinpal.com";
const PAYMENT_REQUEST_PATH = "/pg/v4/payment/request.json";
const PAYMENT_VERIFICATION_PATH = "/pg/v4/payment/verify.json";

/** Request/verify timeout — gateway must answer well before the payment
 *  staleness window (PAYMENT_STALE_AFTER_MS) expires. */
const ZARINPAL_TIMEOUT_MS = 15_000;

export type ZarinPalGatewayConfig = {
  /** Merchant UUID — server-side only, never shipped to the client. */
  merchantId: string;
  sandbox: boolean;
};

/** Read server-side env config; empty string means "not provisioned". */
export function readZarinPalConfig(): ZarinPalGatewayConfig {
  return {
    merchantId: process.env.ZARINPAL_MERCHANT_ID ?? "",
    sandbox: process.env.ZARINPAL_SANDBOX === "true",
  };
}

// ── ZarinPal v4 API shapes ─────────────────────────────────────────────
//
//   request: POST {base}/pg/v4/payment/request.json
//            body { merchant_id, amount, callback_url, description }
//            200 { data: { code, authority }, errors }
//   verify:  POST {base}/pg/v4/payment/verify.json
//            body { merchant_id, amount, authority }
//            200 { data: { code, ref_id }, errors }
//   Shared error body: { errors: { code, message } | [] }

type ZarinPalApiEnvelope<T> = {
  data?: T | [];
  errors?: { code?: unknown; message?: unknown } | [];
};

type ZarinPalRequestData = {
  code?: unknown;
  authority?: unknown;
};

type ZarinPalVerifyData = {
  code?: unknown;
  ref_id?: unknown;
};

/** ZarinPal success/verification codes (documented semantics). */
export const ZARINPAL_CODE_CREATED = 100 as const; // request accepted / verify OK
export const ZARINPAL_CODE_VERIFIED_BEFORE = 101 as const; // already verified (duplicate)

export class ZarinPalGateway implements PaymentGateway {
  readonly provider = ZARINPAL_PROVIDER_ID;
  private readonly config: ZarinPalGatewayConfig;
  /** Injectable for unit tests — production uses global fetch. */
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: ZarinPalGatewayConfig = readZarinPalConfig(),
    fetchImpl: typeof fetch = fetch
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private apiBase(): string {
    return this.config.sandbox
      ? ZARINPAL_SANDBOX_API_BASE
      : ZARINPAL_API_BASE;
  }

  private payEndpoint(): string {
    return this.config.sandbox
      ? ZARINPAL_SANDBOX_PAY_ENDPOINT
      : ZARINPAL_PAY_ENDPOINT;
  }

  /** Validate config + input shape before any network I/O. */
  private ensureCallable(input: { amount: unknown }): void {
    if (!zarinPalConfigLooksValid(this.config)) {
      throw new PaymentGatewayError("REQUEST_FAILED", "config-missing");
    }
    if (!isValidServerAmount(input.amount)) {
      throw new PaymentGatewayError("REQUEST_FAILED", "amount-invalid");
    }
  }

  /** POST JSON with an abort-based timeout; failures map to the stable
   *  PaymentGatewayError taxonomy. merchantId never appears in errors. */
  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    failureCode: "REQUEST_FAILED" | "VERIFY_FAILED"
  ): Promise<T> {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ZARINPAL_TIMEOUT_MS);
      try {
        response = await this.fetchImpl(`${this.apiBase()}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Network failure or abort (timeout) — no provider details leak out.
      throw new PaymentGatewayError("TIMEOUT", "transport");
    }

    if (!response.ok) {
      throw new PaymentGatewayError(failureCode, "http-status");
    }

    let parsed: ZarinPalApiEnvelope<unknown>;
    try {
      parsed = (await response.json()) as ZarinPalApiEnvelope<unknown>;
    } catch {
      throw new PaymentGatewayError("INVALID_RESPONSE", "body-not-json");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new PaymentGatewayError("INVALID_RESPONSE", "body-shape");
    }

    // errors is [] when the call succeeded; an object means the provider
    // rejected it (invalid merchant, wrong amount, bad authority, …).
    const errors = parsed.errors;
    if (
      errors &&
      !Array.isArray(errors) &&
      typeof errors === "object"
    ) {
      throw new PaymentGatewayError(failureCode, "provider-error");
    }

    if (parsed.data === undefined || parsed.data === null || Array.isArray(parsed.data)) {
      throw new PaymentGatewayError("INVALID_RESPONSE", "no-data");
    }

    return parsed.data as T;
  }

  /**
   * Ask ZarinPal to open a payment session. Returns the authority plus the
   * hosted-payment redirect URL. The amount is ALWAYS the server-derived
   * order total — the adapter re-validates it defensively.
   */
  async requestPayment(
    input: GatewayPaymentRequest
  ): Promise<GatewayPaymentRequestResult> {
    this.ensureCallable(input);

    const data = await this.postJson<ZarinPalRequestData>(
      PAYMENT_REQUEST_PATH,
      {
        merchant_id: this.config.merchantId,
        amount: input.amount,
        callback_url: input.callbackUrl,
        description: input.description,
      },
      "REQUEST_FAILED"
    );

    const authority = data.authority;
    if (
      data.code !== ZARINPAL_CODE_CREATED ||
      !isValidGatewayRef(authority)
    ) {
      throw new PaymentGatewayError("REQUEST_FAILED", "no-authority");
    }

    return {
      authority,
      redirectUrl: `${this.payEndpoint()}/${authority}`,
    };
  }

  /**
   * Verify a callback server-side against ZarinPal. Verification MUST use
   * the SAME authoritative amount as the request (always the stored Order
   * total — never a callback-supplied value), so amount tampering between
   * the two calls is impossible.
   *
   * code 100 → verified; code 101 → verified before (duplicate callback);
   * anything else → not paid (rejected / cancelled / invalid authority).
   */
  async verifyPayment(
    input: GatewayVerificationRequest
  ): Promise<GatewayVerificationResult> {
    this.ensureCallable(input);

    if (typeof input.authority !== "string" || !isValidGatewayRef(input.authority)) {
      throw new PaymentGatewayError("VERIFY_FAILED", "authority-invalid");
    }

    const data = await this.postJson<ZarinPalVerifyData>(
      PAYMENT_VERIFICATION_PATH,
      {
        merchant_id: this.config.merchantId,
        amount: input.amount,
        authority: input.authority,
      },
      "VERIFY_FAILED"
    );

    if (
      data.code !== ZARINPAL_CODE_CREATED &&
      data.code !== ZARINPAL_CODE_VERIFIED_BEFORE
    ) {
      // Not paid: user cancelled, gateway rejected, or invalid authority.
      throw new PaymentGatewayError("VERIFY_FAILED", "not-verified");
    }

    const refId = data.ref_id;
    if (
      typeof refId !== "number" ||
      !Number.isSafeInteger(refId) ||
      refId <= 0
    ) {
      throw new PaymentGatewayError("INVALID_RESPONSE", "no-refid");
    }

    // card_pan is deliberately NOT returned/persisted — sensitive card data
    // never enters our records. meta carries only the provider code.
    return {
      refId: String(refId),
      meta: { code: data.code },
    };
  }
}

/** Structural sanity check for the live wiring (no network). */
export function zarinPalConfigLooksValid(
  config: ZarinPalGatewayConfig
): boolean {
  return (
    typeof config.merchantId === "string" &&
    config.merchantId.trim().length >= 36 && // ZarinPal merchant UUIDs are 36 chars
    /^[0-9a-fA-F-]+$/.test(config.merchantId)
  );
}

/** Adapter-level failure taxonomy exists so callers can map transport errors. */
export function zarinPalTransportError(code: PaymentGatewayError["code"]) {
  return new PaymentGatewayError(code, "zarinpal");
}

export type ZarinPalCallbackParams = {
  authority: string | null;
  status: "OK" | "NOK" | null;
};

/**
 * Parse the provider redirect query (ZarinPal sends `Authority` + `Status`).
 * The parsed values are NEVER treated as proof of payment — they only pick
 * the next step (server-side verify vs. cancel); classification of the
 * status string stays here so generic code sees only OK/NOK.
 */
export function zarinPalParseCallback(
  searchParams: URLSearchParams
): ZarinPalCallbackParams {
  const authorityRaw =
    searchParams.get("Authority") ?? searchParams.get("authority");
  const statusRaw = searchParams.get("Status") ?? searchParams.get("status");

  return {
    authority: typeof authorityRaw === "string" && authorityRaw ? authorityRaw : null,
    status: statusRaw === "OK" || statusRaw === "NOK" ? statusRaw : null,
  };
}
