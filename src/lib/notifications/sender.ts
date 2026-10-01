// Notification sender — server-only.
//
// Sends pre-formatted SMS notifications via the configured Kavenegar provider.
// Logs in development (without sensitive content) and fails closed in production
// when no provider is configured.

import "server-only";
import { sendKavenegarNotification } from "@/lib/auth/sms-providers.ts";
import { isConsoleSmsDeliveryAllowed } from "@/lib/auth/guards.ts";

export type NotificationResult = {
  ok: boolean;
  error?: string;
};

/**
 * Send a pre-formatted SMS notification. Fails closed when no provider is
 * configured. In development, logs the recipient (never the message content
 * in production logs to avoid accidental exposure).
 */
export async function sendNotificationMessage(
  phoneNumber: string,
  message: string
): Promise<NotificationResult> {
  if (!phoneNumber) {
    return { ok: false, error: "شماره تلفن الزامی است" };
  }
  if (!message) {
    return { ok: false, error: "متن پیام الزامی است" };
  }

  const consoleAllowed = isConsoleSmsDeliveryAllowed(process.env);

  if (consoleAllowed) {
    console.info(`[NOTIFICATION] Sending SMS to ${phoneNumber}`);
  }

  const result = await sendKavenegarNotification(
    phoneNumber,
    message,
    process.env
  );

  if (!result.ok) {
    return { ok: false, error: result.error ?? "خطا در ارسال پیامک" };
  }

  return { ok: true };
}