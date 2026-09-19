import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { getUserOrders } from "@/lib/auth/account";
import {
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
} from "@/lib/auth/labels";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "سفارش‌ها",
  alternates: { canonical: "/account/orders" },
};

const toneClasses = {
  success: "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]",
  info: "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]",
  warning: "bg-amber-50 text-amber-700",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getUserOrders(user.id);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h1 className="text-lg font-bold text-foreground">سفارش‌های من</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        وضعیت و جزئیات سفارش‌های قبلی خود را دنبال کنید.
      </p>

      <div className="mt-6">
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            هنوز سفارشی ثبت نکرده‌اید.{" "}
            <Link
              href="/products"
              className="font-medium text-[var(--reyhan-blue-700)] hover:underline"
            >
              مشاهده محصولات
            </Link>
          </p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      سفارش{" "}
                      <span dir="ltr" className="tabular-nums">
                        {order.orderNumber}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFaDate(order.createdAt)} ·{" "}
                      {toFaDigits(order.itemCount)} قلم کالا
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        toneClasses[orderStatusTone(order.status)]
                      )}
                    >
                      {orderStatusLabels[order.status]}
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        toneClasses[order.status === "DELIVERED" ? "success" : "warning"]
                      )}
                    >
                      {paymentStatusLabels[order.paymentStatus]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatPriceToman(order.totalAmount)}
                  </p>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    جزئیات سفارش
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
