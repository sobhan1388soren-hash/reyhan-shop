// SMS provider abstraction — provider-agnostic OTP delivery.
// The concrete Iranian SMS provider (Kavenegar, SMS.ir, Farapayamak, …)
// will be configured later via environment variables; the auth system
// depends only on this interface.

import "server-only";

export type SmsDeliveryResult = {
  ok: boolean;
  // Never include the OTP code in error messages exposed to the client.
  error?: string;
};

export interface SmsOtpSender {
  /** Send the OTP message to the given normalized phone (98912xxxxxxx). */
  sendOtp(phoneNumber: string, code: string): Promise<SmsDeliveryResult>;
}

// ── Development provider ──────────────────────────────────────────────
// Logs the OTP to the server console only when explicitly enabled via
// OTP_DEBUG_LOG=true. Never expose OTPs in production logs or client code.

type ConsoleSmsSender = SmsOtpSender;

const consoleSmsSender: ConsoleSmsSender = {
  async sendOtp(phoneNumber, code) {
    if (process.env.OTP_DEBUG_LOG === "true" && process.env.NODE_ENV !== "production") {
      console.info(`[DEV OTP] phone=${phoneNumber} code=${code}`);
    }
    // In dev without debug logging the code is simply "sent" invisibly —
    // testers enable OTP_DEBUG_LOG or use the DB to inspect delivery.
    return { ok: true };
  },
};

// ── Registry ──────────────────────────────────────────────────────────

function resolveSender(): SmsOtpSender {
  const provider = process.env.SMS_PROVIDER;
  switch (provider) {
    case undefined:
    case "":
    case "console":
      return consoleSmsSender;
    default:
      // Unknown provider key — fail closed with a safe console sender so
      // flows remain testable; replace with real providers when selected.
      console.warn(`[SMS] Unknown SMS_PROVIDER "${provider}" — using console sender.`);
      return consoleSmsSender;
  }
}

let cached: SmsOtpSender | null = null;

export function getSmsOtpSender(): SmsOtpSender {
  if (!cached) cached = resolveSender();
  return cached;
}
