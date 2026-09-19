import Link from "next/link";
import { PHONE_NUMBER } from "@/lib/constants";

// HomeConsultationCta — the homepage's consultation/help section.
//
// Contact-target policy: a phone action is rendered ONLY when a phone
// number is actually configured in the existing site settings
// (PHONE_NUMBER); otherwise the section links to real internal paths
// (catalog + knowledge center) instead of fabricating phone numbers,
// WhatsApp targets or addresses.

export function HomeConsultationCta() {
  const hasPhone = PHONE_NUMBER.trim().length > 0;
  const telHref = hasPhone ? `tel:${PHONE_NUMBER.replace(/[\s-]/g, "")}` : null;

  return (
    <section
      aria-labelledby="home-consultation-title"
      className="border-t py-12 sm:py-16"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-l from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)] px-6 py-10 text-center sm:px-10 sm:py-14">
          <h2
            id="home-consultation-title"
            className="text-balance text-xl font-bold text-foreground sm:text-2xl"
          >
            در انتخاب محصول تخصصی کمک می‌خواهید؟
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            برای انتخاب دستگاه تصفیه آب، فیلتر جایگزین یا قطعه یدکی متناسب با
            نیازتان، محصولات ریحان را بررسی کنید و مقالات تخصصی ما را مطالعه
            کنید.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              مشاهده محصولات
            </Link>
            <Link
              href="/blog"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              راهنمای خرید و انتخاب
            </Link>
            {telHref && (
              <a
                href={telHref}
                dir="ltr"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                  <path
                    d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                {PHONE_NUMBER}
              </a>
            )}
          </div>

          {!hasPhone && (
            <p className="mt-5 text-xs text-muted-foreground">
              مسیرهای کمکی:{" "}
              <Link
                href="/products"
                className="font-medium text-[var(--reyhan-blue-600)] hover:underline"
              >
                کاتالوگ محصولات
              </Link>{" "}
              و{" "}
              <Link
                href="/blog"
                className="font-medium text-[var(--reyhan-blue-600)] hover:underline"
              >
                مرکز دانش
              </Link>{" "}
              در دسترس شما هستند.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
