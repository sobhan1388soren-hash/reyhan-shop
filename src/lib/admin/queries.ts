// Admin read queries — server-only, Phase 14-A (orders & customers).
//
// Deliberately READ-ONLY: no mutations live here. Authorization is NOT
// decided in this module — every calling admin page/action must already
// have passed requireAdmin()/requireAdminForAction(); this file assumes
// an authorized server context and never accepts role input from below.
//
// DB failures surface as an explicit "error" outcome so admin pages can
// distinguish "no records yet" (honest empty state) from "database
// unreachable" — unlike public pages, an admin must never be shown an
// empty state that silently hides an outage. No fake data is ever
// substituted.

import "server-only";
import prisma from "@/lib/prisma";
import type { OrderStatus, PaymentStatus, UserStatus, UserRole, Prisma } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";
// Display-safe payment whitelist (Phase 14, Part 2): gateway meta/authority
// are dropped by construction.
import { toAdminPaymentFacts } from "./order-admin-rules.ts";

export type AdminListResult<T> =
  | { state: "ok"; rows: T[]; meta: PaginationMeta }
  | { state: "error" };

export type AdminDetailResult<T> = { state: "ok"; data: T } | { state: "notFound" } | { state: "error" };

// ── Orders ──────────────────────────────────────────────────────────────

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: Date;
  customer: { id: string; name: string; phone: string } | null;
  recipientName: string | null;
  city: string | null;
};

export type AdminOrderListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
};

function orderListWhere(filters: AdminOrderListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.q) {
    // Search across the human order number, recipient snapshot fields,
    // and the registered customer's phone/name — all server-side params.
    where.OR = [
      { orderNumber: { contains: filters.q, mode: "insensitive" } },
      { recipientName: { contains: filters.q, mode: "insensitive" } },
      { recipientPhone: { contains: filters.q } },
      {
        user: {
          OR: [
            { phone: { contains: filters.q } },
            { firstName: { contains: filters.q, mode: "insensitive" } },
            { lastName: { contains: filters.q, mode: "insensitive" } },
            { displayName: { contains: filters.q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  return where;
}

export async function getAdminOrders(
  filters: AdminOrderListFilters
): Promise<AdminListResult<AdminOrderRow>> {
  try {
    const where = orderListWhere(filters);
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
          recipientName: true,
          city: true,
          items: { select: { quantity: true } },
          user: { select: { id: true, firstName: true, lastName: true, displayName: true, phone: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
        createdAt: o.createdAt,
        recipientName: o.recipientName,
        city: o.city,
        customer: o.user
          ? {
              id: o.user.id,
              name:
                o.user.displayName?.trim() ||
                [o.user.firstName?.trim(), o.user.lastName?.trim()].filter(Boolean).join(" ") ||
                "کاربر ریحان",
              phone: o.user.phone,
            }
          : null,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminOrderDetail = {
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
  updatedAt: Date;
  customer: { id: string; name: string; phone: string; role: string } | null;
  recipientName: string | null;
  recipientPhone: string | null;
  province: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine: string | null;
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
  /** Display-safe payment facts only — no gateway meta JSON. */
  payments: {
    id: string;
    amount: number;
    method: string;
    provider: string;
    status: PaymentStatus;
    transactionId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }[];
};

export async function getAdminOrderById(orderId: string): Promise<AdminDetailResult<AdminOrderDetail>> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true, phone: true, role: true },
        },
      },
    });
    if (!order) return { state: "notFound" };
    return {
      state: "ok",
      data: {
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
        updatedAt: order.updatedAt,
        customer: order.user
          ? {
              id: order.user.id,
              name:
                order.user.displayName?.trim() ||
                [order.user.firstName?.trim(), order.user.lastName?.trim()].filter(Boolean).join(" ") ||
                "کاربر ریحان",
              phone: order.user.phone,
              role: order.user.role,
            }
          : null,
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
        payments: order.payments.map(toAdminPaymentFacts),
      },
    };
  } catch {
    return { state: "error" };
  }
}

// ── Customers / users ───────────────────────────────────────────────────

export type AdminUserRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  phoneVerified: boolean;
  createdAt: Date;
  orderCount: number;
};

export type AdminUserListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
};

function userWhere(filters: AdminUserListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { phone: { contains: filters.q } },
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { displayName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function getAdminUsers(
  filters: AdminUserListFilters
): Promise<AdminListResult<AdminUserRow>> {
  try {
    const where = userWhere(filters);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          phone: true,
          email: true,
          role: true,
          status: true,
          phoneVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((u) => ({
        id: u.id,
        name:
          u.displayName?.trim() ||
          [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean).join(" ") ||
          "کاربر ریحان",
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: u.status,
        phoneVerified: u.phoneVerified,
        createdAt: u.createdAt,
        orderCount: u._count.orders,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminUserDetail = {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  province: string | null;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderCount: number;
  paidOrderCount: number;
  lifetimePaidAmount: number;
  addresses: {
    id: string;
    recipientName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string | null;
    addressLine: string;
    isDefault: boolean;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: number;
    createdAt: Date;
  }[];
};

export async function getAdminUserById(userId: string): Promise<AdminDetailResult<AdminUserDetail>> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        role: true,
        status: true,
        province: true,
        city: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            recipientName: true,
            phone: true,
            province: true,
            city: true,
            postalCode: true,
            addressLine: true,
            isDefault: true,
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        _count: { select: { orders: true } },
      },
    });
    if (!user) return { state: "notFound" };

    // Lifetime totals: one aggregate query over PAID orders only.
    const paidAgg = await prisma.order.aggregate({
      where: { userId: user.id, paymentStatus: "PAID" },
      _count: true,
      _sum: { totalAmount: true },
    });

    return {
      state: "ok",
      data: {
        id: user.id,
        name:
          user.displayName?.trim() ||
          [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ") ||
          "کاربر ریحان",
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        email: user.email,
        role: user.role,
        status: user.status,
        province: user.province,
        city: user.city,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        orderCount: user._count.orders,
        paidOrderCount: paidAgg._count,
        lifetimePaidAmount: paidAgg._sum.totalAmount ?? 0,
        addresses: user.addresses,
        recentOrders: user.orders,
      },
    };
  } catch {
    return { state: "error" };
  }
}
