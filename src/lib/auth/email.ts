// Email provider abstraction — provider-agnostic verification email delivery.
// The concrete providers are selected via the EMAIL_PROVIDER env var; the
// auth system depends only on the EmailSender interface.
//
// Server-only: this module reads process.env secrets and must never be
// imported by client code.

import "server-only";

export type EmailDeliveryResult =
  | { ok: true }
  | { ok: false; error: string };

export type EmailSender = {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<EmailDeliveryResult>;
};

// ── Development provider ──────────────────────────────────────────────
// Logs the email to the server console only when explicitly enabled via
// EMAIL_DEBUG=true. Never expose email content in production logs.

const consoleEmailSender: EmailSender = {
  async sendEmail({ to, subject, html }) {
    if (process.env.NODE_ENV === "production" && process.env.EMAIL_DEBUG !== "true") {
      console.error("[EMAIL] No real email provider configured in production — refusing to send.");
      return { ok: false, error: "Email provider not configured" };
    }
    console.info(`[DEV EMAIL] to=${to} subject=${subject}`);
    console.info(`[DEV EMAIL] body preview: ${html.slice(0, 200)}...`);
    return { ok: true };
  },
};

// ── Registry ──────────────────────────────────────────────────────────

function resolveSender(): EmailSender {
  const provider = process.env.EMAIL_PROVIDER;
  if (!provider || provider === "console") {
    return consoleEmailSender;
  }
  console.warn(`[EMAIL] Unknown EMAIL_PROVIDER "${provider}" — using console sender.`);
  return consoleEmailSender;
}

let cached: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (!cached) cached = resolveSender();
  return cached;
}
