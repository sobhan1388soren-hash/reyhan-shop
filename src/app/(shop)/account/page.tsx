import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, userDisplayName } from "@/lib/auth/dal";
import { getDashboardStats } from "@/lib/auth/account";
import { orderStatusLabels } from "@/lib/auth/labels";
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "پیشخوان",
  alternates: { canonical: "/account" },
};

export default async function AccountDashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user.id);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h1 className="text-xl font-bold text-foreground">
          سلام، {userDisplayName(user)} 👋
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          به پیشخوان حساب خود خوش آمدید. از این بخش می‌توانید سفارش‌ها، نشانی‌ها و
          اطلاعات حساب خود را مدیریت کنید.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          عضو ریحان از {formatFaDate(user.createdAt)}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">سفارش‌های من</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {toFaDigits(stats.orderCount)}
          </p>
          <Link
            href="/account/orders"
            className="mt-2 inline-block text-xs font-medium text-[var(--reyhan-blue-700)] hover:underline"
          >
            مشاهده سفارش‌ها ←
          </Link>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">در جریان</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {toFaDigits(stats.activeOrderCount)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">سفارش‌های در حال پردازش و ارسال</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">نشانی‌های ثبت‌شده</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {toFaDigits(stats.addressCount)}
          </p>
          <Link
            href="/account/addresses"
            className="mt-2 inline-block text-xs font-medium text-[var(--reyhan-blue-700)] hover:underline"
          >
            مدیریت نشانی‌ها ←
          </Link>
        </div>
      </div>

      {/* Latest order */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold text-foreground">آخرین سفارش</h2>
        {stats.latestOrder ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground" dir="ltr">
                {stats.latestOrder.orderNumber}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFaDate(stats.latestOrder.createdAt)} ·{" "}
                {orderStatusLabels[stats.latestOrder.status]}
              </p>
            </div>
            <Link
              href={`/account/orders/${stats.latestOrder.id}`}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
            >
              جزئیات سفارش
            </Link>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            هنوز سفارشی ثبت نکرده‌اید. از{" "}
            <Link href="/products" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">
              فروشگاه ریحان
            </Link>{" "}
            شروع کنید.
          </p>
        )}
      </div>

      {/* Default address */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold text-foreground">نشانی پیش‌فرض</h2>
        {stats.defaultAddress ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {stats.defaultAddress.province}، {stats.defaultAddress.city}
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            هنوز نشانی‌ای ثبت نکرده‌اید. برای ثبت نشانی{" "}
            <Link
              href="/account/addresses"
              className="font-medium text-[var(--reyhan-blue-700)] hover:underline"
            >
              اینجا
            </Link>{" "}
            را ببینید.
          </p>
        )}
      </div>
    </div>
  );
}
