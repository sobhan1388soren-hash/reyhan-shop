import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SITE_EMAIL, PHONE_NUMBER } from "@/lib/constants";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "تماس با ما",
  description: "راه‌های تماس با فروشگاه ریحان — پشتیبانی تخصصی تصفیه آب خانگی.",
  alternates: { canonical: canonicalUrl("/contact") },
};

export default function ContactPage() {
  const hasPhone = PHONE_NUMBER.trim().length > 0;

  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            تماس با ما
          </li>
        </ol>
      </nav>

      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          تماس با ریحان
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          تیم ریحان برای راهنمایی در انتخاب دستگاه تصفیه آب، فیلتر جایگزین یا قطعه یدکی در کنار شماست.
          از یکی از مسیرهای زیر با ما در ارتباط باشید.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-600)]">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                  <path d="M2 5.5L8 9L14 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-foreground">ایمیل پشتیبانی</h2>
            </div>
            <a
              href={`mailto:${SITE_EMAIL}`}
              dir="ltr"
              className="mt-3 inline-block text-sm font-medium text-[var(--reyhan-blue-700)] hover:underline"
            >
              {SITE_EMAIL}
            </a>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              پاسخ‌گویی در ساعات کاری (شنبه تا پنجشنبه، ۹ تا ۱۸).
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-600)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                  <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-foreground">مشاوره خرید</h2>
            </div>
            {hasPhone ? (
              <a href={`tel:${PHONE_NUMBER.replace(/[\s-]/g, "")}`} dir="ltr" className="mt-3 inline-block text-sm font-medium text-[var(--reyhan-blue-700)] hover:underline">
                {PHONE_NUMBER}
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                برای دریافت مشاوره تخصصی، از طریق ایمیل با ما در ارتباط باشید یا کاتالوگ محصولات را بررسی کنید.
              </p>
            )}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">پاسخ‌گویی سریع در ساعات کاری.</p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card sm:col-span-2">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                  <path d="M8 14C8 14 12 11.5 12 8C12 5.2 10 3 8 3C6 3 4 5.2 4 8C4 11.5 8 14 8 14Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-foreground">ارسال به سراسر ایران</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              سفارش‌های ریحان به سراسر کشور ارسال می‌شود. هزینه و زمان ارسال پس از ثبت سفارش و پیش از پرداخت نهایی به اطلاع شما می‌رسد.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/products" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]">
                مشاهده محصولات
              </Link>
              <Link href="/blog" className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent">
                مرکز دانش
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border bg-[var(--reyhan-blue-50)]/60 p-5">
          <h2 className="text-sm font-bold text-foreground">ساعات کاری</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">شنبه تا پنجشنبه — ۹:۰۰ تا ۱۸:۰۰ — جمعه و تعطیلات رسمی تعطیل.</p>
        </div>
      </div>
    </Container>
  );
}
