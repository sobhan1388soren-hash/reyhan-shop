import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

// 404 pages are not indexed.
export const metadata: Metadata = buildPrivateMetadata("صفحه مورد نظر یافت نشد");

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
          <path
            d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-foreground">صفحه مورد نظر یافت نشد</h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        آدرسی که وارد کرده‌اید وجود ندارد یا صفحه جابه‌جا شده است. می‌توانید از صفحات
        زیر ادامه دهید.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          بازگشت به صفحه اصلی
        </Link>
        <Link
          href="/products"
          className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          مشاهده محصولات
        </Link>
      </div>
    </Container>
  );
}
