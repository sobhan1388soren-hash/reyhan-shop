"use client";

// Root error boundary — the first error.tsx in the App Router (no segment
// had one). Catches render-time failures anywhere without a closer boundary
// and shows a Persian recovery screen instead of a blank page or the
// Next.js digest dump. Real errors are never disguised as empty states:
// the digest is surfaced for support, the error is logged, and retry keeps
// the user in place. Private/admin pages keep their own noindex metadata.
import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Centralized handling today = server logs; keep the client-side
    // equivalent (no error-reporting vendor is installed).
    console.error("reyhan-web route error", error);
  }, [error]);

  return (
    <Container className="flex flex-1 items-center justify-center py-16 sm:py-20">
      <div
        role="alert"
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-xl border bg-card px-6 py-14 text-center shadow-card"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-10 text-destructive"
          fill="none"
        >
          <path
            d="M12 8v5M12 16.5v.01"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <h1 className="text-lg font-bold text-foreground">مشکلی پیش آمد</h1>
        <p className="max-w-sm text-sm leading-7 text-muted-foreground">
          این صفحه در حال حاضر بارگذاری نمی‌شود. اتصال خود را بررسی کنید و دوباره
          تلاش کنید؛ اگر مشکل ادامه داشت، به صفحه اصلی بازگردید.
        </p>
        {error.digest && (
          <p className="text-[11px] tabular-nums text-muted-foreground" dir="ltr">
            {error.digest}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            تلاش دوباره
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            بازگشت به صفحه اصلی
          </Link>
        </div>
      </div>
    </Container>
  );
}
