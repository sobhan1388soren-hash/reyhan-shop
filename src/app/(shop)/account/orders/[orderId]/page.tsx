import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { getUserOrderById } from "@/lib/auth/account";
import {
  orderStatusLabels,
  orderStatusSteps,
  orderStepIndex,
  isOrderTerminal,
  paymentStatusLabels,
  paymentMethodLabels,
} from "@/lib/auth/labels";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { OrderPlacedBanner } from "@/components/checkout/order-placed-banner";
import { PayAgainButton } from "@/components/payments/pay-again-button";
import type { PaymentMethod } from "@prisma/client";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ placed?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  const user = await requireUser();
  const order = await getUserOrderById(user.id, orderId);
  return {
    title: order ? `سفارش ${order.orderNumber}` : "سفارش یافت نشد",
  };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { orderId } = await params;
  const { placed } = await searchParams;
  const user = await requireUser();
  // User-scoped query — another user's order id simply resolves to 404.
  const order = await getUserOrderById(user.id, orderId);
  if (!order) notFound();

  const stepIndex = orderStepIndex(order.status);
  const terminal = isOrderTerminal(order.status);
  const showPlacedBanner = placed === "1";

  return (
    <div className="space-y-6">
      {/* Post-checkout success banner + guest-cart cleanup */}
      {showPlacedBanner && <OrderPlacedBanner orderNumber={order.orderNumber} />}
      {/* Post-checkout: route the customer straight into the gateway flow */}
      {showPlacedBanner && order.paymentStatus !== "PAID" && order.status === "PENDING" && (
        <PayAgainButton orderId={order.id} label="پرداخت سفارش" />
      )}
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              سفارش{" "}
              <span dir="ltr" className="tabular-nums">
                {order.orderNumber}
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              ثبت‌شده در {formatFaDate(order.createdAt)}
            </p>
          </div>
          <Link
            href="/account/orders"
            className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به سفارش‌ها
          </Link>
        </div>

        {/* Status timeline */}
        <div className="mt-6">
          {terminal ? (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              این سفارش {orderStatusLabels[order.status]} است.
            </p>
          ) : (
            <ol className="flex items-center" aria-label="مراحل سفارش">
              {orderStatusSteps.map((step, i) => {
                const done = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <li
                    key={step}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-2",
                      i < orderStatusSteps.length - 1 && "flex-row"
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    <div className="flex w-full items-center">
                      {/* Connector before (RTL: flows right to left) */}
                      {i > 0 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-0.5 flex-1 rounded-full",
                            i <= stepIndex ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          done
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-border bg-background text-muted-foreground"
                        )}
                      >
                        {done ? "✓" : toFaDigits(i + 1)}
                      </span>
                      {/* Connector after */}
                      {i < orderStatusSteps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-0.5 flex-1 rounded-full",
                            i < stepIndex ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "absolute mt-10 text-[11px] font-medium",
                         current ? "text-[var(--reyhan-blue-700)]" : done ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {orderStatusLabels[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-foreground">اقلام سفارش</h2>
        {order.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">این سفارش قلمی ندارد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">اقلام سفارش</caption>
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-start font-medium">کالا</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">کد کالا</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">قیمت واحد</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">تعداد</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">جمع</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={item.id} className={cn("border-t", i % 2 === 1 && "bg-muted/20")}>
                    <td className="px-4 py-3 font-medium text-foreground">{item.titleSnapshot}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground" dir="ltr">
                      {item.skuSnapshot}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatPriceToman(item.priceSnapshot)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {toFaDigits(item.quantity)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-foreground">
                      {formatPriceToman(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <dt>جمع کالاها</dt>
            <dd className="tabular-nums">{formatPriceToman(order.subtotal)}</dd>
          </div>
          {order.shippingCost > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>هزینه ارسال</dt>
              <dd className="tabular-nums">{formatPriceToman(order.shippingCost)}</dd>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex items-center justify-between text-[var(--reyhan-green-700)]">
              <dt>
                تخفیف
                {order.discountSnapshot?.code && (
                  <span dir="ltr" className="ms-1 text-xs font-medium">
                    ({order.discountSnapshot.code})
                  </span>
                )}
              </dt>
              <dd className="tabular-nums">−{formatPriceToman(order.discountAmount)}</dd>
            </div>
          )}
          {order.shippingCost === 0 && order.discountSnapshot?.type === "FREE_SHIPPING" && (
            <div className="flex items-center justify-between text-[var(--reyhan-green-700)]">
              <dt>ارسال</dt>
              <dd className="tabular-nums">رایگان (کد تخفیف)</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2 font-bold text-foreground">
            <dt>مبلغ کل</dt>
            <dd className="tabular-nums">{formatPriceToman(order.totalAmount)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shipping address */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-base font-semibold text-foreground">نشانی ارسال</h2>
          {order.addressLine ? (
            <address className="mt-4 space-y-1.5 text-sm not-italic leading-7 text-muted-foreground">
              <p className="font-semibold text-foreground">{order.recipientName}</p>
              <p>
                {order.province}، {order.city}
              </p>
              <p>{order.addressLine}</p>
              {order.postalCode && (
                <p dir="ltr" className="tabular-nums">
                  کد پستی: {order.postalCode}
                </p>
              )}
              {order.recipientPhone && (
                <p dir="ltr" className="tabular-nums">
                  {order.recipientPhone}
                </p>
              )}
            </address>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              نشانی ارسال برای این سفارش ثبت نشده است.
            </p>
          )}
          {order.notes && (
            <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground">
              یادداشت سفارش: {order.notes}
            </p>
          )}
        </div>

        {/* Payment info */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-base font-semibold text-foreground">اطلاعات پرداخت</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
              <span className="text-muted-foreground">وضعیت پرداخت</span>
              <span className="font-semibold text-foreground">
                {paymentStatusLabels[order.paymentStatus]}
              </span>
            </div>
            {order.payments.length > 0 ? (
              order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
                >
                  <span className="text-muted-foreground">روش پرداخت</span>
                  <span className="font-semibold text-foreground">
                    {paymentMethodLabels[payment.method as PaymentMethod] ?? payment.method}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                اطلاعات تکمیلی پرداخت در این سفارش ثبت نشده است.
              </p>
            )}
            {/* Gateway reference — only shown after successful verification */}
            {(() => {
              const paid = order.payments.find((p) => p.status === "PAID" && p.paidAt);
              if (!paid) return null;
              return (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                  <span className="text-muted-foreground">تاریخ پرداخت</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatFaDate(paid.paidAt!)}
                  </span>
                </div>
              );
            })()}
            {/* Retry path — order preserved, payable, and not already paid */}
            {order.paymentStatus !== "PAID" && order.status === "PENDING" && (
              <PayAgainButton orderId={order.id} />
            )}
            <Link
              href="/account/invoices"
              className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              مشاهده فاکتورها
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
