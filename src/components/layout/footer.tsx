import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Separator } from "@/components/ui/separator";
import { footerNavigation } from "@/lib/navigation";
import { SITE_NAME } from "@/lib/constants";
import { toFaDigits } from "@/lib/catalog/format";

// Reyhan Footer — Deep Ocean Abyss (Phase 5: Ice Crystal & Neon Emerald)
// Dark abyss gradient, ice-cyan hairlines, frosted trust badges, glowing
// emerald actions. All links/routes unchanged — presentation only.
export function Footer() {
  const year = toFaDigits(new Date().getFullYear());

  return (
    <footer className="relative overflow-hidden border-t border-cyan-500/20 bg-gradient-to-b from-[#042e3a] to-[#021d24] text-cyan-50">
      {/* Ice-cyan top hairline */}
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-l from-transparent via-[#22d3ee]/60 to-transparent"
      />
      {/* Ambient abyss glows (decorative, non-interactive) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 start-[12%] size-64 rounded-full bg-[#22d3ee]/10 blur-3xl" />
        <div className="absolute bottom-0 end-[8%] size-72 rounded-full bg-[#00f5a0]/10 blur-3xl" />
      </div>
      {/* Main footer */}
      <Container className="relative py-10 lg:py-14">
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
              <span className="text-[16px] font-semibold tracking-tight text-white">
                {SITE_NAME}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-cyan-100/70">
              فروشگاه تخصصی تصفیه آب خانگی — دستگاه‌ها، فیلترها، قطعات یدکی و لوازم جانبی. اعتماد، سلامت و تخصص در هر قطره آب.
            </p>
            {/* Trust badges — frosted glass on the abyss */}
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-50 backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-[#00f5a0] shadow-[0_0_8px_1px_rgba(0,245,160,0.7)]" aria-hidden="true" />
                تضمین اصالت کالا
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-50 backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-[#22d3ee] shadow-[0_0_8px_1px_rgba(34,211,238,0.7)]" aria-hidden="true" />
                ارسال به سراسر ایران
              </span>
            </div>
          </div>

          {/* Products */}
          <div className="lg:col-span-3 lg:col-start-6">
            <h3 className="text-sm font-semibold tracking-wide text-white">محصولات</h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.products.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-cyan-100/70 transition-colors hover:text-white hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/products"
                  className="text-sm font-medium text-[#00f5a0] hover:text-[#00f5a0]/80 hover:underline underline-offset-4"
                >
                  مشاهده همه محصولات ←
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold tracking-wide text-white">پشتیبانی</h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.support.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-cyan-100/70 transition-colors hover:text-white hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="sm:col-span-2 lg:col-span-3">
            <h3 className="text-sm font-semibold tracking-wide text-white">تماس با ما</h3>
            <ul className="mt-4 space-y-3 text-sm text-cyan-100/70">
              <li className="flex gap-2.5">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-60" fill="none">
                  <path d="M2 5.5L8 9L14 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <a href="mailto:contact@reyhan.com" className="hover:text-white hover:underline underline-offset-4">
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
                className="inline-flex items-center justify-center rounded-md bg-[#00f5a0] px-4 py-2 text-sm font-semibold text-[#021d24] shadow-[0_0_20px_-4px_rgba(0,245,160,0.5)] transition-all hover:bg-[#00f5a0]/90 hover:shadow-[0_0_28px_-4px_rgba(0,245,160,0.7)]"
              >
                گفت‌وگو با پشتیبانی
              </Link>
            </div>
          </div>
        </div>
      </Container>

      <Separator className="bg-white/10" />

      {/* Bottom bar */}
      <Container className="relative flex flex-col gap-3 py-6 text-xs leading-5 text-cyan-100/60 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {SITE_NAME} — تمامی حقوق محفوظ است.{" "}
          <span className="hidden sm:inline">·</span> <span className="sm:ms-1">آب پاک، خانه‌ای سالم.</span>
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-white hover:underline underline-offset-4">
            حریم خصوصی
          </Link>
          <Link href="/terms" className="hover:text-white hover:underline underline-offset-4">
            قوانین و مقررات
          </Link>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-1 rounded-full bg-[#22d3ee]" aria-hidden="true" />
            طراحی مدرن و تمیز
          </span>
        </div>
      </Container>
    </footer>
  );
}
