// Order administration service — server-only Prisma adapter for the pure
// order rules (./order-admin-rules). Phase 14, Part 2.
//
// Security / integrity model:
//   - every mutation receives an actor resolved server-side by the action
//     layer (requireAdminForAction → DB user row) and re-checks the existing
//     ADMIN/STAFF allow-list; client role input is never trusted
//   - status changes are validated against the SAME transition table the
//     payment engine uses; the write is guarded by the current status so a
//     concurrent change cannot be overwritten
//   - cancellation restores inventory (goods never left the shop) inside one
//     transaction and writes an InventoryTransaction audit row per variant;
//     it never touches payment state, so a paid order remains visibly PAID
//     and no refund is fabricated
//   - DB failures map to stable machine codes — raw Prisma errors never leak

import "server-only";
import prisma from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import { isAdminCapableRole } from "./rules.ts";
import {
  evaluateOrderStatusChange,
  shouldRestoreInventoryOn,
  ORDER_CANCEL_RESTOCK_REASON,
} from "./order-admin-rules.ts";
import type { OrderAdminErrorCode } from "./order-admin-rules.ts";

export type Actor = { id: string; role: string };

export type OrderMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: OrderAdminErrorCode };

const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

function fail(code: OrderAdminErrorCode): OrderMutationResult<never> {
  return { ok: false, error: code };
}

/**
 * Apply an admin-requested order status transition. Cancellation (and any
 * other restock-bearing target) restores stock for every order item whose
 * variant still has an inventory row, all inside one transaction.
 */
export async function updateOrderStatus(
  actor: Actor,
  orderId: string,
  status: unknown
): Promise<OrderMutationResult<{ id: string; status: OrderStatus; restoredItems: number }>> {
  if (!isAdminCapableRole(actor.role)) return fail("FORBIDDEN");
  if (!isOrderStatus(status)) return fail("VALIDATION");

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          items: { select: { variantId: true, quantity: true } },
        },
      });
      if (!order) return fail("NOT_FOUND");

      const evaluation = evaluateOrderStatusChange(order.status, status);
      if (!evaluation.ok) return fail(evaluation.reason);

      // Guarded write: only succeeds while the order is still in the
      // status we validated against (concurrency safety).
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status },
      });
      if (updated.count !== 1) return fail("CONFLICT");

      let restoredItems = 0;
      if (shouldRestoreInventoryOn(status)) {
        for (const item of order.items) {
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
            select: { id: true },
          });
          if (!inventory) continue;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              change: item.quantity,
              reason: ORDER_CANCEL_RESTOCK_REASON,
              orderId: order.id,
            },
          });
          restoredItems += 1;
        }
      }

      return { ok: true as const, data: { id: order.id, status, restoredItems } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}