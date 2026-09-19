import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Separator } from "@/components/ui/separator";
import { footerNavigation } from "@/lib/navigation";
import { SITE_NAME } from "@/lib/constants";
import { toFaDigits } from "@/lib/catalog/format";

// Reyhan Footer — trust footer, Blue/Green/White, medical clean
// 4-column, responsive, Persian RTL logical spacing
export function Footer() {
  const year = toFaDigits(new Date().getFullYear());

  return (
    <footer className="border-t bg-muted/30">
      {/* Main footer */}
      <Container className="py-10 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand — spans 4 */}
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
                  <path
                    d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path d="M12 17.05C12 17.05 13.1 19 15.2 19.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
                </svg>
              </span>
              <span className="text-[16px] font-semibold tracking-tight text-foreground">
                {SITE_NAME}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              فروشگاه تخصصی تصفیه آب خانگی — دستگاه‌ها، فیلترها، قطعات یدکی و لوازم جانبی. اعتماد، سلامت و تخصص در هر قطره آب.
            </p>
            {/* Trust badges — visual only */}
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-[var(--reyhan-green-500)]" aria-hidden="true" />
                تضمین اصالت کالا
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-[var(--reyhan-blue-500)]" aria-hidden="true" />
                ارسال به سراسر ایران
              </span>
            </div>
          </div>

          {/* Products */}
          <div className="lg:col-span-3 lg:col-start-6">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">محصولات</h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.products.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/products"
                  className="text-sm font-medium text-[var(--reyhan-blue-600)] hover:text-[var(--reyhan-blue-700)] hover:underline underline-offset-4"
                >
                  مشاهده همه محصولات ←
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">پشتیبانی</h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.support.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="sm:col-span-2 lg:col-span-3">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">تماس با ما</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-60" fill="none">
                  <path d="M2 5.5L8 9L14 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <a href="mailto:contact@reyhan.com" className="hover:text-foreground hover:underline underline-offset-4">
                  contact@reyhan.com
                </a>
              </li>
              <li className="flex gap-2.5">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-60" fill="none">
                  <path d="M8 14C8 14 12 11.5 12 8C12 5.2 10 3 8 3C6 3 4 5.2 4 8C4 11.5 8 14 8 14Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span>ایران — ارسال به سراسر کشور</span>
              </li>
              <li className="flex gap-2.5">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-60" fill="none">
                  <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 5.2V8L10.2 9.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>شنبه تا پنجشنبه، ۹:۰۰ تا ۱۸:۰۰</span>
              </li>
            </ul>
            <div className="mt-6">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
              >
                گفت‌وگو با پشتیبانی
              </Link>
            </div>
          </div>
        </div>
      </Container>

      <Separator />

      {/* Bottom bar */}
      <Container className="flex flex-col gap-3 py-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {SITE_NAME} — تمامی حقوق محفوظ است.{" "}
          <span className="hidden sm:inline">·</span> <span className="sm:ms-1">آب پاک، خانه‌ای سالم.</span>
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline underline-offset-4">
            حریم خصوصی
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline underline-offset-4">
            قوانین و مقررات
          </Link>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-1 rounded-full bg-[var(--reyhan-blue-600)]" aria-hidden="true" />
            طراحی مدرن و تمیز
          </span>
        </div>
      </Container>
    </footer>
  );
}
