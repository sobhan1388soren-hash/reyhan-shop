"use client";

// Post-order cart cleanup — mounted on the order-detail page when arriving
// from checkout (`?placed=1`). Clears the guest localStorage cart exactly
// once after the order has been created server-side, and shows a small
// success banner. The `placed` param is only produced by our checkout
// action's redirect, never trusted for logic beyond display.

import * as React from "react";
import { useCart } from "@/hooks/use-cart";
import { toFaDigits } from "@/lib/catalog/format";

export function OrderPlacedBanner({ orderNumber }: { orderNumber: string }) {
  const { entries, clearCart } = useCart();
  const [cleared, setCleared] = React.useState(false);
  const clearedRef = React.useRef(false);

  React.useEffect(() => {
    // localStorage is hydrated on first client effect; clear once, after it
    // has definitely been read (entries array is populated by then).
    if (clearedRef.current) return;
    clearedRef.current = true;
    const t = window.setTimeout(() => {
      clearCart();
      setCleared(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [clearCart]);

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-xl border border-[var(--reyhan-green-500)]/40 bg-[var(--reyhan-green-50)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--reyhan-green-100)] text-[var(--reyhan-green-700)]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold text-[var(--reyhan-green-700)]">
            سفارش شما با موفقیت ثبت شد
          </p>
          <p className="mt-1 text-xs leading-6 text-[var(--reyhan-green-700)]/80">
            شماره سفارش: <span dir="ltr" className="font-semibold tabular-nums">{orderNumber}</span>
            {" — "}
            {cleared || entries.length === 0
              ? "سبد خرید شما خالی شد. برای پرداخت، دکمه «پرداخت سفارش» را بزنید."
              : "در حال پاک‌سازی سبد خرید…"}
          </p>
        </div>
      </div>
      <p className="text-xs font-medium text-[var(--reyhan-green-700)]/80 sm:text-left">
        وضعیت پرداخت: در انتظار پرداخت ({toFaDigits(1)} روش — اینترنتی)
      </p>
    </div>
  );
}
