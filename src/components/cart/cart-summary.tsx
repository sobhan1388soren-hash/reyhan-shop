"use client";

// Cart summary — server-validated subtotal, reserved discount/shipping areas,
// CTAs. Checkout is a disabled placeholder (Phase 9+). No invented values.

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import type { CartValidationResult } from "@/lib/cart/types";

type CartSummaryProps = {
  cart: CartValidationResult;
  updating: boolean;
};

export function CartSummary({ cart, updating }: CartSummaryProps) {
  const canProceed = cart.purchasableCount > 0 && cart.allPurchasable && !updating;

  return (
    <aside
      aria-label="خلاصه سفارش"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-24"
    >
      <h2 className="text-base font-bold text-foreground">خلاصه سفارش</h2>

      {/* Subtotal — only server-validated values */}
      <dl className="space-y-2.5 border-t pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">مجموع کالاها</dt>
          <dd className={cn("tabular-nums font-semibold text-foreground", updating && "opacity-50")}>
            {formatPriceToman(cart.subtotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">تعداد اقلام</dt>
          <dd className="tabular-nums text-foreground">
            {toFaDigits(cart.purchasableCount)} قلم از {toFaDigits(cart.totalCount)}
          </dd>
        </div>

        {/* Discount placeholder — Discount system arrives in a later phase */}
        <div className="flex items-center justify-between text-muted-foreground/80">
          <dt>تخفیف</dt>
          <dd className="text-xs">در مرحله پرداخت اعمال می‌شود</dd>
        </div>

        {/* Shipping placeholder — engine arrives in Checkout phase */}
        <div className="flex items-center justify-between text-muted-foreground/80">
          <dt>هزینه ارسال</dt>
          <dd className="text-xs">در مرحله پرداخت محاسبه می‌شود</dd>
        </div>
      </dl>

      {/* Final payable — only known valid values */}
      <div className="space-y-1 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">مبلغ قابل پرداخت</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums text-foreground",
              updating && "opacity-50"
            )}
          >
            {formatPriceToman(cart.subtotal)}
          </span>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          مبلغ نهایی با احتساب هزینه ارسال و تخفیف‌های احتمالی، در مرحله پرداخت مشخص می‌شود.
        </p>
      </div>

      {/* CTAs */}
      <div className="space-y-2.5">
        {canProceed ? (
          <Link
            href="/checkout"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            تسویه حساب و پرداخت
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="ابتدا وضعیت اقلام سبد را حل کنید"
            className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-secondary text-sm font-semibold text-muted-foreground"
          >
            تسویه حساب و پرداخت
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {canProceed ? null : (
          cart.totalCount > 0 && (
            <p role="status" className="text-[11px] font-medium text-amber-600">
              ابتدا وضعیت اقلام ناموجود را حل کنید (حذف یا تغییر گزینه) تا بتوانید ادامه دهید.
            </p>
          )
        )}

        <Link
          href="/products"
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          ادامه خرید
        </Link>
      </div>

      {/* Trust hints */}
      <div className="flex items-center gap-2 border-t pt-4 text-[11px] text-muted-foreground">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-[var(--reyhan-green-600)]" fill="none">
          <path
            d="M8 1.5L13.5 3.5V7C13.5 10.5 11 13 8 14.5C5 13 2.5 10.5 2.5 7V3.5L8 1.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 7.5L7.2 9.2L10.5 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        پرداخت امن و حفظ اصالت کالا — قیمت‌ها هنگام پرداخت نهایی دوباره بررسی می‌شوند.
      </div>
    </aside>
  );
}
