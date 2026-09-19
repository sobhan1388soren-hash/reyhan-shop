// Order creation — server-authoritative, atomic.
// All values written to the Order/OrderItem/Payment rows come from the
// final validation pass (live DB prices/stock), never from the client.
// Multiple dependent writes (order + items + payment + inventory
// decrements + inventory transaction log) run inside ONE Prisma
// interactive transaction so the operation is all-or-nothing.

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateOrderNumber } from "./totals";
import type { FinalValidationResult } from "./validate";

// Order-number generation lives in ./totals (pure, testable without a DB).

/**
 * Create the order atomically. Returns the created order's id/number.
 * Payment is recorded as ONLINE / PENDING — no gateway is contacted
 * (that is Phase 10); the order stays PENDING until payment completes.
 */
export async function createOrderFromCheckout(
  userId: string,
  validated: FinalValidationResult
): Promise<{ id: string; orderNumber: string }> {
  const { cart, address, totals, discount } = validated;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // ── Re-verify stock inside the transaction (concurrency guard) ──────
    // The validated cart rows were read moments ago; the transaction
    // re-checks available stock so concurrent checkouts can't oversell.
    const variantIds = cart.items
      .filter((i) => i.purchasable)
      .map((i) => i.variantId);

    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { inventory: true, product: { select: { id: true, status: true, title: true } } },
    });

    const variantById = new Map(variants.map((v) => [v.id, v]));

    for (const item of cart.items) {
      if (!item.purchasable) continue;
      const variant = variantById.get(item.variantId);
      if (!variant || !variant.product || variant.product.status !== "ACTIVE" || !variant.isActive) {
        throw new Error("CHECKOUT_ITEM_UNAVAILABLE");
      }
      const inv = variant.inventory;
      const available = inv ? inv.quantity - inv.reservedQuantity : 0;
      if (available < item.quantity) {
        throw new Error("CHECKOUT_STOCK_CHANGED");
      }
    }

    // ── Order row — server-computed totals, denormalized address snapshot ──
    // Phase 12: totals are the single source of truth (free shipping is
    // already reflected in totals.shippingCost), and the applied discount
    // is snapshotted so historical orders never depend on the mutable
    // Discount row (code may be edited/deactivated later).
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(now),
        userId,
        status: "PENDING",
        paymentStatus: "PENDING",
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        ...(discount
          ? {
              discountId: discount.discountId,
              discountCodeSnapshot: discount.code,
              discountTypeSnapshot: discount.type,
              discountValueSnapshot: discount.value,
            }
          : {}),
        recipientName: address.recipientName,
        recipientPhone: address.phone,
        province: address.province,
        city: address.city,
        postalCode: address.postalCode,
        addressLine: address.addressLine,
      },
      select: { id: true, orderNumber: true },
    });

    // ── Order items — price snapshots taken from CURRENT DB prices ─────
    await tx.orderItem.createMany({
      data: cart.items
        .filter((i) => i.purchasable)
        .map((item) => {
          const variant = variantById.get(item.variantId)!;
          return {
            orderId: order.id,
            productId: variant.product.id,
            variantId: variant.id,
            titleSnapshot: `${variant.product.title} — ${variant.title}`,
            skuSnapshot: variant.sku,
            priceSnapshot: variant.price,
            quantity: item.quantity,
            total: variant.price * item.quantity,
          };
        }),
    });

    // ── Payment — ONLINE / PENDING; no gateway call in this phase ──────
    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: totals.totalAmount,
        method: "ONLINE",
        provider: "OTHER", // real provider is a Phase 10 decision
        status: "PENDING",
      },
    });

    // ── Inventory — decrement sold stock + audit trail ────────────────
    for (const item of cart.items) {
      if (!item.purchasable) continue;
      const variant = variantById.get(item.variantId)!;
      if (!variant.inventory) continue;

      const updated = await tx.inventory.updateMany({
        where: {
          variantId: variant.id,
          // Optimistic guard: only succeed when stock is still sufficient.
          quantity: { gte: variant.inventory.reservedQuantity + item.quantity },
        },
        data: { quantity: { decrement: item.quantity } },
      });
      if (updated.count !== 1) {
        throw new Error("CHECKOUT_STOCK_CHANGED");
      }

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: variant.inventory.id,
          change: -item.quantity,
          reason: "ORDER",
          orderId: order.id,
        },
      });
    }

    return order;
  });
}

/** Map infrastructure failures to stable machine codes for the action layer. */
export function isDbUnavailableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "CHECKOUT_STOCK_CHANGED" ||
      error.message === "CHECKOUT_ITEM_UNAVAILABLE" ||
      // Prisma transaction/connection failures surface with these prefixes.
      error.message.includes("PrismaClient") ||
      (error as { code?: string }).code === "P1001")
  );
}

// Keep Prisma types referenced for future query extensions.
export type OrderTx = Prisma.TransactionClient;
