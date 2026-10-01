"use server";

// Order management server actions — Phase 14, Part 2.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default).
// The service validates the transition against the existing order state
// machine and performs any inventory restoration transactionally.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import { updateOrderStatus } from "@/lib/admin/order-service";
import { ORDER_ADMIN_MESSAGES } from "@/lib/admin/order-admin-rules";
import type { OrderAdminErrorCode } from "@/lib/admin/order-admin-rules";
import { sendOrderShippedNotification } from "@/lib/notifications";
import prisma from "@/lib/prisma";

export type OrderActionState = {
  message?: string;
  error?: string;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(error: OrderAdminErrorCode): OrderActionState {
  return { error: ORDER_ADMIN_MESSAGES[error] };
}

function revalidateOrders(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  // Order status affects storefront availability (cancellation restocks).
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateOrderStatusAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const actor = await requireAdminForAction();
  const orderId = str(formData, "orderId");
  if (!orderId) return failure("VALIDATION");

  const result = await updateOrderStatus(actor, orderId, str(formData, "status"));
  if (!result.ok) return failure(result.error);

  revalidateOrders(orderId);

  const { status, restoredItems } = result.data;
  if (status === "CANCELLED") {
    return {
      message:
        restoredItems > 0
          ? `سفارش لغو شد و موجودی ${restoredItems} قلم به انبار بازگردانده شد. وضعیت پرداخت بدون تغییر باقی ماند.`
          : "سفارش لغو شد. وضعیت پرداخت بدون تغییر باقی ماند.",
    };
  }
  if (status === "RETURNED") {
    return { message: "سفارش به‌عنوان مرجوع‌شده ثبت شد." };
  }

  if (status === "SHIPPED") {
    const trackingCode = str(formData, "trackingCode");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, orderNumber: true },
    });
    if (order?.userId) {
      sendOrderShippedNotification({
        userId: order.userId,
        orderNumber: order.orderNumber,
        trackingCode: trackingCode || undefined,
      }).catch((err: unknown) =>
        console.error("[NOTIFICATION] order shipped failed:", err)
      );
    }
  }

  return { message: "وضعیت سفارش به‌روزرسانی شد." };
}