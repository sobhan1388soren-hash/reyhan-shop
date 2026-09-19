// Gateway payment UX states — Persian/RTL copy for the Phase 10-B flow.
// Pure mapping from flow outcome kinds to user-facing strings; no DB,
// no server-only imports, safe to import from client components.

import type { GatewayCallbackOutcome, StartGatewayPaymentOutcome } from "./flow.ts";
import type { PaymentRejectReason } from "./errors.ts";
import { paymentRejectMessage } from "./errors.ts";

export type GatewayUxState =
  | "redirecting" // در حال انتقال به درگاه
  | "verifying" // در حال بررسی پرداخت
  | "success" // پرداخت موفق
  | "failed" // پرداخت ناموفق
  | "cancelled" // پرداخت لغو شد
  | "already-paid" // پرداخت قبلاً ثبت شده
  | "gateway-error"; // خطای ارتباط با درگاه

export const GATEWAY_UX_COPY: Readonly<
  Record<GatewayUxState, { title: string; description: string; tone: "success" | "warning" | "destructive" | "info" }>
> = {
  redirecting: {
    title: "در حال انتقال به درگاه…",
    description: "لطفاً چند لحظه صبر کنید؛ به صفحه پرداخت امن منتقل می‌شوید.",
    tone: "info",
  },
  verifying: {
    title: "در حال بررسی پرداخت…",
    description:
      "نتیجه پرداخت شما در حال بررسی است. لطفاً این صفحه را نبندید؛ تا چند لحظه دیگر وضعیت مشخص می‌شود.",
    tone: "warning",
  },
  success: {
    title: "پرداخت موفق",
    description: "پرداخت شما با موفقیت تأیید و سفارش ثبت نهایی شد.",
    tone: "success",
  },
  failed: {
    title: "پرداخت ناموفق",
    description:
      "پرداخت انجام نشد. سفارش شما حفظ شده است و می‌توانید دوباره تلاش کنید. در صورت کسر مبلغ، طی ۷۲ ساعت به حسابتان بازمی‌گردد.",
    tone: "destructive",
  },
  cancelled: {
    title: "پرداخت لغو شد",
    description:
      "شما پرداخت را در درگاه لغو کردید. سفارش شما حفظ شده است و در صورت تمایل می‌توانید پرداخت را دوباره شروع کنید.",
    tone: "warning",
  },
  "already-paid": {
    title: "پرداخت قبلاً ثبت شده",
    description: "این سفارش پیش‌تر با موفقیت پرداخت شده است.",
    tone: "success",
  },
  "gateway-error": {
    title: "خطای ارتباط با درگاه",
    description:
      "ارتباط با درگاه پرداخت برقرار نشد. سفارش شما حفظ شده است؛ لطفاً دوباره تلاش کنید.",
    tone: "destructive",
  },
};

export function gatewayUxCopy(state: GatewayUxState) {
  return GATEWAY_UX_COPY[state];
}

/** Callback outcome → UX state shown on the result page. */
export function callbackOutcomeToUx(outcome: GatewayCallbackOutcome): GatewayUxState {
  switch (outcome.kind) {
    case "SUCCESS":
      return "success";
    case "ALREADY_PAID":
      return "already-paid";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
      return "failed";
    case "VERIFY_ERROR":
      return "verifying";
    case "INVALID":
      return "gateway-error";
  }
}

/** Start outcome → UX state (server action / route level). */
export function startOutcomeToUx(outcome: StartGatewayPaymentOutcome): GatewayUxState {
  if (outcome.ok) {
    switch (outcome.kind) {
      case "REDIRECT":
        return "redirecting";
      case "VERIFIED_EXISTING":
      case "ALREADY_PAID":
        return "already-paid";
    }
  }
  return "gateway-error";
}

/** UX state for an engine reject reason surfaced on the result page. */
export function rejectReasonToUx(reason: PaymentRejectReason): GatewayUxState {
  switch (reason) {
    case "ALREADY_PAID":
      return "already-paid";
    case "AMOUNT_MISMATCH":
      return "failed";
    default:
      return "gateway-error";
  }
}

export function rejectMessageSafe(reason: PaymentRejectReason): string {
  return paymentRejectMessage(reason);
}
