import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireUser } from "@/lib/auth/dal";
import { getUserOrderById } from "@/lib/auth/account";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { ClearCartOnMount } from "./clear-cart";

export const metadata: Metadata = {
  title: "سفارش ثبت شد",
  description: "سفارش شما با موفقیت در فروشگاه ریحان ثبت شد.",
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const { orderId } = await searchParams;

  if (!orderId) redirect("/checkout");

  const order = await getUserOrderById(user.id, orderId);
  if (!order) redirect("/account/orders");

  return (
    <Container className="py-10 sm:py-14">
      <ClearCartOnMount />
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-white/80 bg-white/80 p-6 text-center shadow-xl backdrop-blur-xl sm:p-10">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-[#00f5a0] bg-[#00f5a0]/20 text-[#00f5a0]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-10" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="mt-6 text-2xl font-bold text-foreground sm:text-3xl">
            سفارش شما با موفقیت ثبت شد
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            سفارش شما با موفقیت در سیستم ثبت شد. کد پیگیری سفارش و جزئیات آن در ادامه نمایش داده شده است.
          </p>

          <dl className="mt-8 space-y-3 rounded-xl border border-border/50 bg-background/60 px-5 py-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">شماره سفارش</dt>
              <dd dir="ltr" className="font-semibold tabular-nums text-foreground">
                {order.orderNumber}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">مبلغ کل</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatPriceToman(order.totalAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">وضعیت</dt>
              <dd className="font-medium text-[var(--reyhan-blue-700)]">در حال پردازش</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">زمان تقریبی تحویل</dt>
              <dd className="font-medium text-foreground">
                {toFaDigits(3)} تا {toFaDigits(5)} روز کاری
              </dd>
            </div>
          </dl>

          {order.items.length > 0 && (
            <div className="mt-6 rounded-xl border border-border/50 bg-background/60 px-5 py-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">اقلام سفارش</h2>
              <ul className="space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.titleSnapshot} × {toFaDigits(item.quantity)}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatPriceToman(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/products"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#042e3a] text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(4,46,58,0.4)] transition-all duration-300 hover:bg-[#083f52] hover:shadow-[0_8px_32px_-6px_rgba(14,165,200,0.5)]"
            >
              ادامه خرید از فروشگاه
            </Link>
            <Link
              href="/account/orders"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              پیگیری سفارشات
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
