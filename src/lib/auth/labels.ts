// Persian label maps for order/payment states — single source of truth.

import type { OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client";

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "در انتظار تأیید",
  CONFIRMED: "تأیید شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شد",
  DELIVERED: "تحویل داده شد",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

export const orderStatusSteps: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

// Terminal states that display instead of the linear timeline.
export const orderTerminalStatuses: OrderStatus[] = ["CANCELLED", "RETURNED"];

export function isOrderTerminal(status: OrderStatus): boolean {
  return orderTerminalStatuses.includes(status);
}

/** Index in the happy-path timeline; -1 for terminal states. */
export function orderStepIndex(status: OrderStatus): number {
  return orderStatusSteps.indexOf(status);
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  REFUNDED: "بازگشت داده شده",
  CANCELLED: "لغو شده",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  ONLINE: "پرداخت آنلاین",
  COD: "پرداخت در محل",
  CARD_TO_CARD: "کارت به کارت",
};

// Badge tone per order status — matches the Reyhan design tokens.
export function orderStatusTone(
  status: OrderStatus
): "success" | "info" | "warning" | "muted" | "destructive" {
  switch (status) {
    case "DELIVERED":
    case "CONFIRMED":
      return "success";
    case "PROCESSING":
      return "info";
    case "SHIPPED":
      return "info";
    case "PENDING":
      return "warning";
    case "CANCELLED":
    case "RETURNED":
      return "destructive";
  }
}

export function paymentStatusTone(
  status: PaymentStatus
): "success" | "info" | "warning" | "muted" | "destructive" {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "destructive";
    case "REFUNDED":
      return "muted";
  }
}
