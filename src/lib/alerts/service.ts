// Alerts service — server-only, DB-backed.
//
// Evaluates price and stock alerts and triggers notifications.

import "server-only";
import prisma from "@/lib/prisma";
import {
  sendPriceDropNotification,
  sendBackInStockNotification,
} from "@/lib/notifications";

export async function evaluatePriceAlertsForVariant(
  variantId: string,
  newPrice: number
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  const alerts = await prisma.priceAlert.findMany({
    where: {
      variantId,
      status: true,
      notifiedAt: null,
    },
    include: {
      user: { select: { id: true, phone: true } },
      variant: { select: { id: true, title: true } },
    },
  });

  for (const alert of alerts) {
    if (alert.targetPrice != null && newPrice > alert.targetPrice) {
      continue;
    }

    const productTitle =
      alert.variant?.title ?? `محصول #${alert.variantId.slice(0, 8)}`;

    try {
      await sendPriceDropNotification({
        userId: alert.userId,
        productTitle,
        newPrice,
      });

      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { status: false, notifiedAt: new Date() },
      });

      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}

export async function evaluateStockAlertsForVariant(
  variantId: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      inventory: { select: { quantity: true } },
      product: { select: { title: true } },
    },
  });

  if (!variant || !variant.inventory) return { sent, errors };

  if (variant.inventory.quantity <= 0) return { sent, errors };

  const alerts = await prisma.stockAlert.findMany({
    where: {
      variantId,
      status: true,
      notifiedAt: null,
    },
    include: {
      user: { select: { id: true } },
    },
  });

  const productTitle = variant.product?.title ?? `محصول #${variantId.slice(0, 8)}`;

  for (const alert of alerts) {
    try {
      await sendBackInStockNotification({
        userId: alert.userId,
        productTitle,
      });

      await prisma.stockAlert.update({
        where: { id: alert.id },
        data: { status: false, notifiedAt: new Date() },
      });

      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}

export async function subscribePriceAlert(
  userId: string,
  variantId: string,
  targetPrice?: number
): Promise<{ ok: boolean; error?: string }> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { price: true },
  });

  if (!variant) {
    return { ok: false, error: "محصول یافت نشد" };
  }

  try {
    await prisma.priceAlert.upsert({
      where: {
        userId_variantId: { userId, variantId },
      },
      create: {
        userId,
        variantId,
        initialPrice: variant.price,
        targetPrice,
      },
      update: {
        targetPrice,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "خطا در ثبت هشدار قیمت" };
  }
}

export async function subscribeStockAlert(
  userId: string,
  variantId: string
): Promise<{ ok: boolean; error?: string }> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { inventory: true },
  });

  if (!variant) {
    return { ok: false, error: "محصول یافت نشد" };
  }

  if (variant.inventory && variant.inventory.quantity > 0) {
    return { ok: false, error: "این محصول در حال حاضر موجود است" };
  }

  try {
    await prisma.stockAlert.upsert({
      where: {
        userId_variantId: { userId, variantId },
      },
      create: {
        userId,
        variantId,
      },
      update: {},
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "خطا در ثبت هشدار موجودی" };
  }
}

export async function unsubscribePriceAlert(
  userId: string,
  variantId: string
): Promise<void> {
  await prisma.priceAlert.deleteMany({
    where: { userId, variantId },
  });
}

export async function unsubscribeStockAlert(
  userId: string,
  variantId: string
): Promise<void> {
  await prisma.stockAlert.deleteMany({
    where: { userId, variantId },
  });
}