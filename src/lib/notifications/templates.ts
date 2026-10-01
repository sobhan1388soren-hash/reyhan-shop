// Notification message templates — pure, DB-free.

import { SITE_NAME } from "../constants.ts";

export type NotificationTemplateKey =
  | "ORDER_PLACED"
  | "ORDER_PAID"
  | "ORDER_SHIPPED"
  | "PRICE_DROP"
  | "BACK_IN_STOCK";

export type TemplateInput = {
  orderNumber?: string;
  trackingCode?: string;
  productTitle?: string;
  newPrice?: number;
  siteName?: string;
};

function toPersianDigits(n: number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n)
    .split("")
    .map((d) => persianDigits[parseInt(d)] ?? d)
    .join("");
}

export function buildNotificationMessage(
  template: NotificationTemplateKey,
  input: TemplateInput
): string {
  const siteName = input.siteName ?? SITE_NAME;

  switch (template) {
    case "ORDER_PLACED":
      return `سفارش شما با موفقیت ثبت شد. شماره سفارش: ${input.orderNumber}. منتظر تأیید و ارسال باشید.${siteName ? ` ${siteName}` : ""}`;

    case "ORDER_PAID":
      return `پرداخت سفارش ${input.orderNumber} با موفقیت تأیید شد.${siteName ? ` ${siteName}` : ""}`;

    case "ORDER_SHIPPED":
      if (input.trackingCode) {
        return `سفارش ${input.orderNumber} ارسال شد. کد رهگیری پستی: ${input.trackingCode}.${siteName ? ` ${siteName}` : ""}`;
      }
      return `سفارش ${input.orderNumber} ارسال شد و به زودی تحویل داده می‌شود.${siteName ? ` ${siteName}` : ""}`;

    case "PRICE_DROP": {
      const priceStr = input.newPrice != null ? toPersianDigits(input.newPrice) : "?";
      return `قیمت محصول "${input.productTitle}" کاهش یافت. قیمت جدید: ${priceStr} تومان. همین الان سفارش دهید!${siteName ? ` ${siteName}` : ""}`;
    }

    case "BACK_IN_STOCK":
      return `محصول "${input.productTitle}" مجدداً موجود شد! فرصت را از دست ندهید.${siteName ? ` ${siteName}` : ""}`;

    default:
      throw new TypeError(`Unknown notification template: ${template}`);
  }
}

export function formatPriceForSms(priceInRial: number): string {
  return toPersianDigits(priceInRial);
}