import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminUserById } from "@/lib/admin/queries";
import {
  orderStatusLabels,
  paymentStatusLabels,
} from "@/lib/auth/labels";
import {
  userStatusLabels,
  userRoleLabels,
  userStatusTones,
  orderStatusTones,
  paymentStatusTones,
} from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { UserActionsPanel } from "@/components/admin/user-actions-panel";
import { formatFaDate, formatNumber, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "جزئیات کاربر",
};

type PageProps = {
  params: Promise<{ userId: string }>;
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

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const actor = await requireAdmin();
  const result = await getAdminUserById(userId);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="جزئیات کاربر" />
        <AdminListErrorState onRetryHref="/admin/users" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const user = result.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.name}
        description={`عضو از ${formatFaDate(user.createdAt)}`}
        actions={
          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به کاربران
          </Link>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">کل سفارش‌ها</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatNumber(user.orderCount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">سفارش‌های پرداختی</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatNumber(user.paidOrderCount)}</p>
        </div>
        <div className="col-span-2 rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">مجموع خرید موفق</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {formatPriceToman(user.lifetimePaidAmount)}
          </p>
        </div>
      </div>

      <SectionCard title="مدیریت حساب">
        <div className="mt-4">
          <UserActionsPanel
            userId={user.id}
            status={user.status}
            role={user.role}
            isSelf={actor.id === user.id}
            canManage={actor.adminRole === "ADMIN"}
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="اطلاعات حساب">
          {/* Display-safe fields only — no OTP tokens, sessions, or hashes. */}
          <dl className="mt-4">
            <Fact label="شماره موبایل">
              <span dir="ltr" className="tabular-nums">{user.phone}</span>
            </Fact>
            <Fact label="تأیید شماره">
              {user.phoneVerified ? (
                <AdminStatusBadge tone="success">تأیید شده</AdminStatusBadge>
              ) : (
                <AdminStatusBadge tone="warning">تأیید نشده</AdminStatusBadge>
              )}
            </Fact>
            <Fact label="ایمیل">
              <span dir="ltr" className="break-all">{user.email ?? "—"}</span>
            </Fact>
            <Fact label="نقش">{userRoleLabels[user.role] ?? user.role}</Fact>
            <Fact label="وضعیت حساب">
              <AdminStatusBadge tone={userStatusTones[user.status] ?? "neutral"}>
                {userStatusLabels[user.status] ?? user.status}
              </AdminStatusBadge>
            </Fact>
            {user.city && (
              <Fact label="شهر/استان">
                {user.province ? `${user.province}، ${user.city}` : user.city}
              </Fact>
            )}
            <Fact label="تاریخ عضویت">
              <span className="tabular-nums">{formatFaDate(user.createdAt)}</span>
            </Fact>
            <Fact label="آخرین به‌روزرسانی">
              <span className="tabular-nums">{formatFaDate(user.updatedAt)}</span>
            </Fact>
          </dl>
        </SectionCard>

        <SectionCard title={`نشانی‌ها (${toFaDigits(user.addresses.length)})`}>
          {user.addresses.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">این کاربر نشانی ثبت‌شده‌ای ندارد.</p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="نشانی‌های کاربر">
              {user.addresses.map((address) => (
                <li key={address.id} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{address.recipientName}</p>
                    {address.isDefault && <AdminStatusBadge tone="info">پیش‌فرض</AdminStatusBadge>}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {address.province}، {address.city} — {address.addressLine}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground" dir="ltr">
                    {address.phone}
                    {address.postalCode ? ` · کد پستی: ${address.postalCode}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="آخرین سفارش‌ها">
        {user.recentOrders.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">این کاربر هنوز سفارشی ثبت نکرده است.</p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border" aria-label="آخرین سفارش‌های کاربر">
            {user.recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
                    dir="ltr"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatFaDate(order.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone={orderStatusTones[order.status]}>
                    {orderStatusLabels[order.status]}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={paymentStatusTones[order.paymentStatus]}>
                    {paymentStatusLabels[order.paymentStatus]}
                  </AdminStatusBadge>
                  <span className="text-sm font-bold tabular-nums">{formatPriceToman(order.totalAmount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          تنها ۱۰ سفارش اخیر نمایش داده می‌شود.
        </p>
      </SectionCard>
    </div>
  );
}
