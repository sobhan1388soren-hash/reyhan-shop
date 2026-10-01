// SMS provider abstraction — provider-agnostic OTP delivery.
// The concrete providers are selected via the SMS_PROVIDER env var; the
// auth system depends only on the SmsOtpSender interface.
//
// Server-only: this module reads process.env secrets (KAVENEGAR_API_KEY)
// and must never be imported by client code. All provider selection and
// response mapping is delegated to the pure, DB-free ./sms-providers.ts
// module so the fail-closed decisions stay unit-testable.

import "server-only";
import { isConsoleSmsDeliveryAllowed } from "./guards.ts";
import {
  SMS_PROVIDER_CONSOLE,
  SMS_PROVIDER_KAVENEGAR,
  createKavenegarSmsSender,
  resolveSmsProvider,
  type SmsDeliveryResult,
  type SmsOtpSender,
} from "./sms-providers.ts";

// Re-export the shared contract for existing importers.
export type { SmsDeliveryResult, SmsOtpSender };

// ── Development provider ──────────────────────────────────────────────
// Logs the OTP to the server console only when explicitly enabled via
// OTP_DEBUG_LOG=true. Never expose OTPs in production logs or client code.

type ConsoleSmsSender = SmsOtpSender;

const consoleSmsSender: ConsoleSmsSender = {
  async sendOtp(phoneNumber, code) {
    // Decision logic lives in the pure, unit-tested ./guards module.
    if (!isConsoleSmsDeliveryAllowed(process.env)) {
      // Fail closed: the console sender delivers nothing. Pretending success
      // here would issue real (hashed, verifiable) OTP tokens the user can
      // never receive. Production must configure a real SMS provider.
      console.error("[SMS] No real SMS provider configured in production — refusing to issue OTP.");
      return { ok: false, error: "SMS provider not configured" };
    }
    if (process.env.OTP_DEBUG_LOG === "true") {
      console.info(`[DEV OTP] phone=${phoneNumber} code=${code}`);
    }
    // In dev without debug logging the code is simply "sent" invisibly —
    // testers enable OTP_DEBUG_LOG or use the DB to inspect delivery.
    // OTP values NEVER reach production logs: delivery is refused above
    // before any logging can happen.
    return { ok: true };
  },
};

// ── Registry ──────────────────────────────────────────────────────────

function resolveSender(): SmsOtpSender {
  const resolution = resolveSmsProvider(process.env);
  if (resolution.unrecognized) {
    // Unknown provider key — fail closed with a safe console sender so
    // flows remain testable; real providers are only used when explicitly
    // selected with a matching configuration.
    console.warn(
      `[SMS] Unknown SMS_PROVIDER "${process.env.SMS_PROVIDER}" — using console sender.`
    );
    return consoleSmsSender;
  }
  switch (resolution.key) {
    case SMS_PROVIDER_KAVENEGAR:
      // The Kavenegar sender fails closed on its own when the API key is
      // missing — it never falls back to the console sender.
      return createKavenegarSmsSender(process.env);
    case SMS_PROVIDER_CONSOLE:
    default:
      return consoleSmsSender;
  }
}

let cached: SmsOtpSender | null = null;

export function getSmsOtpSender(): SmsOtpSender {
  if (!cached) cached = resolveSender();
  return cached;
}
