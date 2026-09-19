import Link from "next/link";
import { Container } from "@/components/layout/container";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HeaderAccountLink } from "@/components/layout/header-account-link";
import { HeaderCartLink } from "@/components/layout/header-cart-link";

// Reyhan Header — trust & expertise, modern clean
// Sticky, backdrop-blur, blue+green+white palette, Persian RTL logical props
export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Top trust bar — desktop only, health signal */}
      <div className="hidden border-b bg-[var(--reyhan-blue-50)]/70 lg:block">
        <Container className="flex h-8 items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--reyhan-green-500)]" aria-hidden="true" />
              پشتیبانی تخصصی تصفیه آب خانگی
            </span>
            <span className="hidden items-center gap-1.5 xl:inline-flex">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 opacity-60" fill="none">
                <path
                  d="M8 14C8 14 12 11.5 12 8C12 5.2 10 3 8 3C6 3 4 5.2 4 8C4 11.5 8 14 8 14Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              ارسال به سراسر ایران
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">
              تماس با ما
            </Link>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <Link href="/blog" className="text-muted-foreground hover:text-foreground">
              وبلاگ
            </Link>
          </div>
        </Container>
      </div>

      {/* Main bar */}
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-[68px]">
        {/* Logo — wordmark + water drop motif */}
        <Link
          href="/"
          aria-label="ریحان — صفحه اصلی"
          className="flex shrink-0 items-center gap-3"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:size-10">
            {/* Minimal water drop + leaf — trust/health */}
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 lg:size-5.5" fill="none">
              <path
                d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M12 17.05C12 17.05 13.1 19 15.2 19.8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path
                d="M9.5 11.2C9.5 11.2 10.4 11.8 11.2 11.8"
                stroke="white"
                strokeWidth="1.1"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-semibold text-foreground lg:text-[19px]">
              ریحان
            </span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              تصفیه آب خانگی
            </span>
          </span>
        </Link>

        {/* Center nav — desktop */}
        <MainNav />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <HeaderCartLink />

          {/* Account / login */}
          <HeaderAccountLink />

          <Link
            href="/contact"
            className="hidden items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] sm:inline-flex lg:px-5"
          >
            مشاوره خرید
          </Link>

          {/* Mobile trigger */}
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
