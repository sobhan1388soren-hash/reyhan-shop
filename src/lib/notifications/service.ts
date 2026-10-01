// Notification service — server-only, DB-backed.
//
// The ONLY entry point for sending SMS notifications to users.
// Handles template rendering, delivery, and audit logging to NotificationLog.

import "server-only";
import prisma from "@/lib/prisma";
import { sendNotificationMessage } from "./sender";
import { buildNotificationMessage, type NotificationTemplateKey } from "./templates";
import type { NotificationType } from "@prisma/client";

function templateToNotificationType(
  template: NotificationTemplateKey
): NotificationType {
  switch (template) {
    case "ORDER_PLACED":
      return "ORDER_PLACED";
    case "ORDER_PAID":
      return "ORDER_PAID";
    case "ORDER_SHIPPED":
      return "ORDER_SHIPPED";
    case "PRICE_DROP":
      return "PRICE_DROP";
    case "BACK_IN_STOCK":
      return "BACK_IN_STOCK";
  }
}

export async function sendOrderPlacedNotification(input: {
  userId: string;
  orderNumber: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendNotificationInternal({
    userId: input.userId,
    template: "ORDER_PLACED",
    templateInput: { orderNumber: input.orderNumber },
  });
}

export async function sendOrderPaidNotification(input: {
  userId: string;
  orderNumber: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendNotificationInternal({
    userId: input.userId,
    template: "ORDER_PAID",
    templateInput: { orderNumber: input.orderNumber },
  });
}

export async function sendOrderShippedNotification(input: {
  userId: string;
  orderNumber: string;
  trackingCode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendNotificationInternal({
    userId: input.userId,
    template: "ORDER_SHIPPED",
    templateInput: {
      orderNumber: input.orderNumber,
      trackingCode: input.trackingCode,
    },
  });
}

export async function sendPriceDropNotification(input: {
  userId: string;
  productTitle: string;
  newPrice: number;
}): Promise<{ ok: boolean; error?: string }> {
  return sendNotificationInternal({
    userId: input.userId,
    template: "PRICE_DROP",
    templateInput: {
      productTitle: input.productTitle,
      newPrice: input.newPrice,
    },
  });
}

export async function sendBackInStockNotification(input: {
  userId: string;
  productTitle: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendNotificationInternal({
    userId: input.userId,
    template: "BACK_IN_STOCK",
    templateInput: { productTitle: input.productTitle },
  });
}

async function sendNotificationInternal(input: {
  userId: string;
  template: NotificationTemplateKey;
  templateInput: {
    orderNumber?: string;
    trackingCode?: string;
    productTitle?: string;
    newPrice?: number;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true },
  });

  if (!user?.phone) {
    console.error("[NOTIFICATION] User has no phone number for notification");
    return { ok: false, error: "User phone not found" };
  }

  const message = buildNotificationMessage(input.template, input.templateInput);

  const result = await sendNotificationMessage(user.phone, message);

  await prisma.notificationLog.create({
    data: {
      userId: input.userId,
      type: templateToNotificationType(input.template),
      message,
      status: result.ok ? "SENT" : "FAILED",
    },
  });

  return result;
}