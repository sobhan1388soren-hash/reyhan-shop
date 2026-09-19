import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminOrderById } from "@/lib/admin/queries";
import {
  orderStatusLabels,
  paymentStatusLabels,
  paymentMethodLabels,
} from "@/lib/auth/labels";
import { orderStatusTones, paymentStatusTones, discountTypeLabel } from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { OrderStatusPanel } from "@/components/admin/order-status-panel";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { SITE_NAME } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "جزئیات سفارش",
    template: `%s | ${SITE_NAME}`,
  },
};

type PageProps = {
  params: Promise<{ orderId: string }>;
};

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card sm:p-6", className)}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  await requireAdmin();
  const result = await getAdminOrderById(orderId);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="جزئیات سفارش" />
        <AdminListErrorState onRetryHref="/admin/orders" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const order = result.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          <>
            سفارش{" "}
            <span dir="ltr" className="tabular-nums">
              {order.orderNumber}
            </span>
          </>
        }
        description={`ثبت‌شده در ${formatFaDate(order.createdAt)}`}
        actions={
          <Link
            href="/admin/orders"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به سفارش‌ها
          </Link>
        }
      />

      {/* Status + customer identity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="وضعیت سفارش">
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={orderStatusTones[order.status]} className="px-3 py-1 text-xs">
              {orderStatusLabels[order.status]}
            </AdminStatusBadge>
            <AdminStatusBadge tone={paymentStatusTones[order.paymentStatus]} className="px-3 py-1 text-xs">
              {paymentStatusLabels[order.paymentStatus]}
            </AdminStatusBadge>
          </div>
          <div className="mt-5 border-t pt-5">
            <OrderStatusPanel
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
            />
          </div>
          <dl className="mt-5 border-t pt-4">
            <Fact label="تاریخ ثبت">{formatFaDate(order.createdAt)}</Fact>
            <Fact label="آخرین به‌روزرسانی">{formatFaDate(order.updatedAt)}</Fact>
          </dl>
        </SectionCard>

        <SectionCard title="مشتری">
          {order.customer ? (
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-semibold text-foreground">
                <Link
                  href={`/admin/users/${order.customer.id}`}
                  className="hover:text-[var(--reyhan-blue-700)] hover:underline"
                >
                  {order.customer.name}
                </Link>
              </p>
              <p className="tabular-nums text-muted-foreground" dir="ltr">
                {order.customer.phone}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-semibold text-foreground">{order.recipientName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">سفارش بدون حساب کاربری</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Items */}
      <SectionCard title="اقلام سفارش">
        {order.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">این سفارش قلمی ندارد.</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full text-sm">
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
            <ul className="mt-4 divide-y rounded-lg border md:hidden" aria-label="اقلام سفارش">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.titleSnapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {toFaDigits(item.quantity)} × {formatPriceToman(item.priceSnapshot)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPriceToman(item.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <dt>جمع کالاها</dt>
                <dd className="tabular-nums">{formatPriceToman(order.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <dt>هزینه ارسال</dt>
                <dd className="tabular-nums">
                  {order.shippingCost === 0 ? "رایگان" : formatPriceToman(order.shippingCost)}
                </dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex items-center justify-between text-[var(--reyhan-green-700)]">
                  <dt>
                    تخفیف
                    {order.discountSnapshot?.code && (
                      <span dir="ltr" className="ms-1 text-xs font-medium">
                        ({order.discountSnapshot.code}
                        {discountTypeLabel(order.discountSnapshot.type)
                          ? ` — ${discountTypeLabel(order.discountSnapshot.type)}`
                          : ""}
                        )
                      </span>
                    )}
                  </dt>
                  <dd className="tabular-nums">−{formatPriceToman(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-2 font-bold text-foreground">
                <dt>مبلغ کل</dt>
                <dd className="tabular-nums">{formatPriceToman(order.totalAmount)}</dd>
              </div>
            </dl>
          </>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="نشانی ارسال">
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
        </SectionCard>

        <SectionCard title="پرداخت‌ها">
          {order.payments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              برای این سفارش تلاش پرداختی ثبت نشده است.
            </p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="تلاش‌های پرداخت">
              {order.payments.map((payment) => (
                <li key={payment.id} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {paymentMethodLabels[payment.method as PaymentMethod] ?? payment.method}
                    </span>
                    <AdminStatusBadge tone={paymentStatusTones[payment.status]}>
                      {paymentStatusLabels[payment.status]}
                    </AdminStatusBadge>
                  </div>
                  <dl className="mt-2">
                    <Fact label="مبلغ">{formatPriceToman(payment.amount)}</Fact>
                    <Fact label="ارائه‌دهنده">{payment.provider}</Fact>
                    <Fact label="ثبت">
                      <span className="tabular-nums">{formatFaDate(payment.createdAt)}</span>
                    </Fact>
                    {payment.paidAt && (
                      <Fact label="پرداخت">
                        <span className="tabular-nums">{formatFaDate(payment.paidAt)}</span>
                      </Fact>
                    )}
                    {payment.transactionId && (
                      <Fact label="کد رهگیری">
                        <span dir="ltr" className="break-all tabular-nums">
                          {payment.transactionId}
                        </span>
                      </Fact>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
