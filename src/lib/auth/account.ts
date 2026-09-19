// Account data queries — server-only, always scoped to the session user.

import "server-only";
import prisma from "@/lib/prisma";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

export type AccountOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  createdAt: Date;
  itemCount: number;
};

export async function getUserOrders(userId: string, take = 20): Promise<AccountOrder[]> {
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: { items: { select: { quantity: true } } },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    }));
  } catch {
    return [];
  }
}

export type AccountOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: Date;
  recipientName: string | null;
  recipientPhone: string | null;
  province: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine: string | null;
  /** Phase 12: durable discount snapshot — independent of the mutable Discount row. */
  discountSnapshot: {
    code: string | null;
    type: string | null;
    value: number | null;
    amount: number;
  } | null;
  items: {
    id: string;
    titleSnapshot: string;
    skuSnapshot: string;
    priceSnapshot: number;
    quantity: number;
    total: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: PaymentStatus;
    paidAt: Date | null;
  }[];
};

export async function getUserOrderById(
  userId: string,
  orderId: string
): Promise<AccountOrderDetail | null> {
  try {
    const order = await prisma.order.findFirst({
      // Authorization lives in the where-clause: userId from the session.
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) return null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      notes: order.notes,
      createdAt: order.createdAt,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      province: order.province,
      city: order.city,
      postalCode: order.postalCode,
      addressLine: order.addressLine,
      discountSnapshot: order.discountCodeSnapshot
        ? {
            code: order.discountCodeSnapshot,
            type: order.discountTypeSnapshot,
            value: order.discountValueSnapshot,
            amount: order.discountAmount,
          }
        : null,
      items: order.items.map((i) => ({
        id: i.id,
        titleSnapshot: i.titleSnapshot,
        skuSnapshot: i.skuSnapshot,
        priceSnapshot: i.priceSnapshot,
        quantity: i.quantity,
        total: i.total,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
      })),
    };
  } catch {
    return null;
  }
}

export type AccountInvoice = {
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paidAt: Date | null;
};

// Invoices are derived from orders + payments (no dedicated model needed).
export async function getUserInvoices(userId: string, take = 20): Promise<AccountInvoice[]> {
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return orders.map((o) => {
      const paid = o.payments[0];
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        paymentMethod: paid?.method ?? null,
        paidAt: o.payments.find((p) => p.paidAt)?.paidAt ?? null,
      };
    });
  } catch {
    return [];
  }
}

export type DashboardStats = {
  orderCount: number;
  activeOrderCount: number;
  addressCount: number;
  defaultAddress: { city: string; province: string } | null;
  latestOrder: { id: string; orderNumber: string; status: OrderStatus; createdAt: Date } | null;
};

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const empty: DashboardStats = {
    orderCount: 0,
    activeOrderCount: 0,
    addressCount: 0,
    defaultAddress: null,
    latestOrder: null,
  };
  try {
    const [orderCount, activeOrderCount, addressCount, defaultAddressRow, latestOrderRow] =
      await Promise.all([
        prisma.order.count({ where: { userId } }),
        prisma.order.count({
          where: { userId, status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"] } },
        }),
        prisma.address.count({ where: { userId } }),
        prisma.address.findFirst({ where: { userId, isDefault: true } }),
        prisma.order.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
      ]);
    return {
      orderCount,
      activeOrderCount,
      addressCount,
      defaultAddress: defaultAddressRow
        ? { city: defaultAddressRow.city, province: defaultAddressRow.province }
        : null,
      latestOrder: latestOrderRow
        ? {
            id: latestOrderRow.id,
            orderNumber: latestOrderRow.orderNumber,
            status: latestOrderRow.status,
            createdAt: latestOrderRow.createdAt,
          }
        : null,
    };
  } catch {
    return empty;
  }
}
