// Payment failure taxonomy — machine codes plus Persian user messages.
// The engine returns these codes; the message map is the single place the
// UI (and Phase 10-B actions) translate them for customers.

export type PaymentRejectReason =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "ALREADY_PAID"
  | "INVALID_TRANSITION"
  | "AMOUNT_MISMATCH"
  | "STATE_CONFLICT";

export const PAYMENT_REJECT_MESSAGES: Readonly<Record<PaymentRejectReason, string>> = {
  INVALID_REQUEST: "درخواست پرداخت نامعتبر است.",
  NOT_FOUND: "پرداخت مورد نظر یافت نشد.",
  FORBIDDEN: "شما به این پرداخت دسترسی ندارید.",
  ALREADY_PAID: "این پرداخت پیش‌تر با موفقیت ثبت شده است.",
  INVALID_TRANSITION: "تغییر وضعیت درخواستی برای این پرداخت مجاز نیست.",
  AMOUNT_MISMATCH: "مبلغ پرداخت با مبلغ سفارش هم‌خوانی ندارد.",
  STATE_CONFLICT: "وضعیت سفارش با تغییر پرداخت هم‌خوانی ندارد؛ موضوع بررسی می‌شود.",
};

export function paymentRejectMessage(reason: PaymentRejectReason): string {
  return PAYMENT_REJECT_MESSAGES[reason];
}
