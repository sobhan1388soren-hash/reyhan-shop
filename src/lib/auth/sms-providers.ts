// SMS provider selection + provider-specific shaping — pure & DB-free.
//
// Mirrors the auth/guards.ts convention: every fail-closed provider
// decision and every provider response mapping lives here so it is
// unit-testable in a bare `node --test` process. The server-only
// auth/sms.ts module is the ONLY production caller; nothing here reads
// process.env implicitly — env is always passed in as a parameter.
//
// Security: KAVENEGAR_API_KEY is only ever passed as a function argument.
// It is never logged, never echoed back in error text, and never shipped
// to the client. Transport/provider failures collapse to fixed generic
// SmsDeliveryResult errors so Kavenegar internals (which can echo account
// details) never reach the browser.

import { normalizePhone } from "./phone.ts";
import { SITE_NAME } from "../constants.ts";

// ── Shared delivery contract ─────────────────────────────────────────────
// Re-exported by the server-only ./sms.ts so existing imports keep working.

export type SmsDeliveryResult = {
  ok: boolean;
  // Never include the OTP code in error messages exposed to the client.
  error?: string;
};

export interface SmsOtpSender {
  /** Send the OTP message to the given normalized phone (98912xxxxxxx). */
  sendOtp(phoneNumber: string, code: string): Promise<SmsDeliveryResult>;
}

/** Generic delivery failure — the only failure text that can reach callers. */
export const SMS_DELIVERY_FAILED_RESULT: SmsDeliveryResult = {
  ok: false,
  error: "SMS delivery failed",
};

/** Provider not provisioned — mirrors the console sender's production refusal. */
export const SMS_NOT_CONFIGURED_RESULT: SmsDeliveryResult = {
  ok: false,
  error: "SMS provider not configured",
};

// ── Provider registry ────────────────────────────────────────────────────

export const SMS_PROVIDER_CONSOLE = "console" as const;
export const SMS_PROVIDER_KAVENEGAR = "kavenegar" as const;
export const SMS_PROVIDER_KEYS = [
  SMS_PROVIDER_CONSOLE,
  SMS_PROVIDER_KAVENEGAR,
] as const;
export type SmsProviderKey = (typeof SMS_PROVIDER_KEYS)[number];

export type EnvLike = {
  SMS_PROVIDER?: string;
  KAVENEGAR_API_KEY?: string;
  KAVENEGAR_SENDER?: string;
  NODE_ENV?: string;
};

export type SmsProviderResolution = {
  key: SmsProviderKey;
  /** True when SMS_PROVIDER held an unrecognized value (degraded to console). */
  unrecognized: boolean;
};

/**
 * Resolve the SMS provider from the environment. Unknown keys degrade to
 * the console sender — which itself fails closed in production — so a
 * misconfigured deployment never silently "works" as if a real provider
 * were wired up. NODE_ENV never changes the selection: with kavenegar
 * chosen there is no fallback to the console sender, in any environment.
 */
export function resolveSmsProvider(env: EnvLike): SmsProviderResolution {
  const raw = env.SMS_PROVIDER?.trim();
  if (!raw || raw === SMS_PROVIDER_CONSOLE) {
    return { key: SMS_PROVIDER_CONSOLE, unrecognized: false };
  }
  if (raw === SMS_PROVIDER_KAVENEGAR) {
    return { key: SMS_PROVIDER_KAVENEGAR, unrecognized: false };
  }
  return { key: SMS_PROVIDER_CONSOLE, unrecognized: true };
}

// ── Kavenegar REST API ───────────────────────────────────────────────────
//   POST https://api.kavenegar.com/v1/{API-KEY}/sms/send.json
//        body { receptor, message, sender? }
//   Kavenegar answers HTTP 200 even for application-level rejections and
//   reports the real outcome in `return.status` (200 = accepted, queued).

export const KAVENEGAR_API_BASE = "https://api.kavenegar.com";
export const KAVENEGAR_SEND_PATH = "/v1/{apiKey}/sms/send.json";
export const KAVENEGAR_TIMEOUT_MS = 10_000;
export const KAVENEGAR_SUCCESS_STATUS = 200;

export type KavenegarConfigResolution =
  | { ok: true; apiKey: string }
  | { ok: false };

/**
 * Resolve the server-side Kavenegar API key. Empty/whitespace means "not
 * provisioned" — callers must fail closed rather than attempt delivery.
 */
export function resolveKavenegarApiKey(env: EnvLike): KavenegarConfigResolution {
  const apiKey = env.KAVENEGAR_API_KEY?.trim();
  if (!apiKey) return { ok: false };
  return { ok: true, apiKey };
}

/**
 * Optional sender/line number. Kavenegar treats `sender` as OPTIONAL and
 * uses the account's default line when it is omitted — so we omit it
 * unless explicitly provisioned, and never invent a number.
 */
export function resolveKavenegarSender(env: EnvLike): string | undefined {
  const sender = env.KAVENEGAR_SENDER?.trim();
  return sender || undefined;
}

/** Full REST URL — the API key rides the path, so this is never logged. */
export function kavenegarSendUrl(apiKey: string): string {
  return `${KAVENEGAR_API_BASE}${KAVENEGAR_SEND_PATH.replace("{apiKey}", apiKey)}`;
}

// ── OTP message ──────────────────────────────────────────────────────────
// Single source of truth for the SMS body. The CODE itself always comes
// from the existing auth/otp.ts issuance flow — this only formats it.

export function buildOtpMessage(code: string): string {
  return `کد یکبار مصرف ${SITE_NAME}: ${code}`;
}

// ── Request shaping ──────────────────────────────────────────────────────

export type KavenegarSendInput = {
  apiKey: string;
  phone: string;
  message: string;
  sender?: string;
};

/**
 * Build the JSON body. `sender` is omitted entirely when not provisioned
 * so Kavenegar falls back to the account's default line.
 */
export function buildKavenegarRequestBody(input: {
  phone: string;
  message: string;
  sender?: string;
}): Record<string, string> {
  const body: Record<string, string> = {
    receptor: input.phone,
    message: input.message,
  };
  if (input.sender) body.sender = input.sender;
  return body;
}

/**
 * Normalize a receptor with the SAME Reyhan phone normalization used by the
 * auth flows (98912xxxxxxx). Returns null when the input is not a valid
 * Iranian mobile — the sender then refuses to deliver.
 */
export function resolveKavenegarReceptor(phone: string): string | null {
  const check = normalizePhone(phone);
  return check.ok ? check.phone : null;
}

// ── Response mapping ─────────────────────────────────────────────────────

type KavenegarEnvelope = {
  return?: { status?: unknown; message?: unknown };
  entries?: unknown;
};

/**
 * Map a parsed Kavenegar response to the generic delivery result. Success
 * requires return.status === 200 AND a non-empty entries array. Only fixed
 * generic failure text is ever returned — provider payloads (which can
 * echo account details) never reach the caller or the client.
 */
export function parseKavenegarResult(json: unknown): SmsDeliveryResult {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return SMS_DELIVERY_FAILED_RESULT;
  }
  const envelope = json as KavenegarEnvelope;
  if (envelope.return?.status !== KAVENEGAR_SUCCESS_STATUS) {
    return SMS_DELIVERY_FAILED_RESULT;
  }
  if (!Array.isArray(envelope.entries) || envelope.entries.length === 0) {
    return SMS_DELIVERY_FAILED_RESULT;
  }
  return { ok: true };
}

/**
 * Perform the Kavenegar send. `fetchImpl` is injectable for unit tests;
 * production passes the global fetch from the server-only caller.
 *
 * Every failure (transport, timeout, non-200 HTTP, provider rejection,
 * malformed body) collapses to the SAME generic failure result — callers
 * never see Kavenegar internals, and the API key is never logged.
 */
export async function sendKavenegarOtp(
  input: KavenegarSendInput,
  fetchImpl: typeof fetch = fetch
): Promise<SmsDeliveryResult> {
  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KAVENEGAR_TIMEOUT_MS);
    try {
      response = await fetchImpl(kavenegarSendUrl(input.apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildKavenegarRequestBody(input)),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network failure or abort (timeout) — no provider details leak out.
    return SMS_DELIVERY_FAILED_RESULT;
  }

  if (!response.ok) return SMS_DELIVERY_FAILED_RESULT;

  try {
    return parseKavenegarResult(await response.json());
  } catch {
    // Body was not JSON — treat as delivery failure.
    return SMS_DELIVERY_FAILED_RESULT;
  }
}

// ── Sender factory ───────────────────────────────────────────────────────

/**
 * Build a Kavenegar-backed SmsOtpSender from an environment snapshot.
 * Reads NOTHING from process.env directly — the server-only caller passes
 * it in — so the entire delivery path is unit-testable.
 */
export function createKavenegarSmsSender(
  env: EnvLike,
  fetchImpl: typeof fetch = fetch
): SmsOtpSender {
  return {
    async sendOtp(phoneNumber, code) {
      const keyResolution = resolveKavenegarApiKey(env);
      if (!keyResolution.ok) {
        // Fail closed: no key means no delivery. Pretending success would
        // issue real (hashed, verifiable) OTP tokens the user never gets.
        console.error(
          "[SMS] KAVENEGAR_API_KEY is not configured — refusing to issue OTP."
        );
        return SMS_NOT_CONFIGURED_RESULT;
      }

      const receptor = resolveKavenegarReceptor(phoneNumber);
      if (!receptor) {
        // Never send to a malformed receptor.
        console.error("[SMS] Refusing to send OTP to an invalid phone number.");
        return SMS_DELIVERY_FAILED_RESULT;
      }

      return sendKavenegarOtp(
        {
          apiKey: keyResolution.apiKey,
          phone: receptor,
          message: buildOtpMessage(code),
          sender: resolveKavenegarSender(env),
        },
        fetchImpl
      );
    },
  };
}

// ── Notification sender (pre-formatted messages) ──────────────────────────

/**
 * Send a pre-formatted notification via Kavenegar. Unlike sendKavenegarOtp
 * (which wraps the input in buildOtpMessage), this sends the message as-is.
 * fetchImpl is injectable for unit tests.
 */
export async function sendKavenegarNotification(
  phone: string,
  message: string,
  env: EnvLike,
  fetchImpl: typeof fetch = fetch
): Promise<SmsDeliveryResult> {
  const keyResolution = resolveKavenegarApiKey(env);
  if (!keyResolution.ok) {
    return SMS_NOT_CONFIGURED_RESULT;
  }

  const receptor = resolveKavenegarReceptor(phone);
  if (!receptor) {
    return SMS_DELIVERY_FAILED_RESULT;
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KAVENEGAR_TIMEOUT_MS);
    try {
      response = await fetchImpl(kavenegarSendUrl(keyResolution.apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildKavenegarRequestBody({
            phone: receptor,
            message,
            sender: resolveKavenegarSender(env),
          })
        ),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return SMS_DELIVERY_FAILED_RESULT;
  }

  if (!response.ok) return SMS_DELIVERY_FAILED_RESULT;

  try {
    return parseKavenegarResult(await response.json());
  } catch {
    return SMS_DELIVERY_FAILED_RESULT;
  }
}
