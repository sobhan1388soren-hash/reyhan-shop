import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCheckoutSnapshot } from "@/lib/checkout/validate";

// Transactional/private page — never indexable.
export const metadata: Metadata = {
  title: "تسویه حساب",
  description: "تکمیل و پرداخت سفارش در فروشگاه ریحان.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CheckoutPage() {
  // Server-side auth guard — guests never see checkout (the proxy is only
  // the first optimistic filter; this is the secure check).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  // DB failures surface as a clear state, never fake data.
  let snapshot;
  try {
    snapshot = await getCheckoutSnapshot({ userId: user.id, cartEntries: [] });
  } catch {
    return (
      <Container className="py-10">
        <CheckoutUnavailableState />
      </Container>
    );
  }

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <nav aria-label="مسیر صفحه" className="mb-4 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-50">/</li>
          <li>
            <Link href="/cart" className="transition-colors hover:text-foreground">
              سبد خرید
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-50">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            تسویه حساب
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">تسویه حساب و پرداخت</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        نشانی ارسال و روش‌های ارسال و پرداخت را تکمیل کنید. قیمت‌ها و موجودی کالاها
        پیش از ثبت نهایی، یک بار دیگر در فروشگاه بررسی می‌شوند.
      </p>

      <div className="mt-8">
        <CheckoutView
          addresses={snapshot.addresses}
          shippingMethods={snapshot.shippingMethods}
          paymentMethods={snapshot.paymentMethods}
          defaultAddressId={snapshot.defaultAddressId}
        />
      </div>
    </Container>
  );
}

function CheckoutUnavailableState() {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border bg-card px-6 py-14 text-center shadow-card"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-10 text-destructive" fill="none">
        <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <h1 className="text-lg font-bold text-foreground">فعلاً امکان تسویه حساب وجود ندارد</h1>
      <p className="max-w-sm text-sm leading-7 text-muted-foreground">
        اتصال فروشگاه برقرار نیست. سبد خرید شما محفوظ می‌ماند؛ لطفاً کمی بعد دوباره تلاش کنید.
      </p>
      <Link
        href="/cart"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
      >
        بازگشت به سبد خرید
      </Link>
    </div>
  );
}
