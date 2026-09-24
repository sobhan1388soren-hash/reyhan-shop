"use client";

// Checkout order summary — server-validated items, discount-code area
// (Phase 12), shipping, final payable amount, and the submit CTA.
// Every displayed price comes from server validation; nothing here is
// computed from client-trusted values. The summary renders four discount
// states: none, applied, invalid/error, and applying.

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import type { CartValidationResult } from "@/lib/cart/types";

/** Client-side mirror of the server preview (all numbers server-derived). */
export type AppliedDiscountPreview = {
  code: string;
  amount: number;
  freeShipping: boolean;
};

type CheckoutSummaryProps = {
  cart: CartValidationResult;
  updating: boolean;
  pending: boolean;
  /** Raw code currently in the input. */
  discountCode: string;
  onDiscountCodeChange: (value: string) => void;
  onApplyDiscount: (e: React.FormEvent<HTMLFormElement>) => void;
  onRemoveDiscount: () => void;
  /** Server-validated applied discount; null until the server accepts a code. */
  appliedDiscount: AppliedDiscountPreview | null;
  /** Persian status/error copy for the discount area. */
  discountNotice: string | null;
  discountNoticeTone: "info" | "error" | "success";
  /** True while the server is evaluating the code. */
  discountApplying: boolean;
  canSubmit: boolean;
  addressSelected: boolean;
};

export function CheckoutSummary({
  cart,
  updating,
  pending,
  discountCode,
  onDiscountCodeChange,
  onApplyDiscount,
  onRemoveDiscount,
  appliedDiscount,
  discountNotice,
  discountNoticeTone,
  discountApplying,
  canSubmit,
  addressSelected,
}: CheckoutSummaryProps) {
  const discountedSubtotal = cart.subtotal;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const freeShipping = appliedDiscount?.freeShipping ?? false;

  return (
    <aside
      aria-label="خلاصه سفارش"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-24"
    >
      <h2 className="text-base font-bold text-foreground">خلاصه سفارش</h2>

      {/* Items — compact, scannable list */}
      {/* Scrollable region is keyboard-focusable, so it carries a name. */}
      <ul
        className="max-h-72 space-y-3 overflow-y-auto border-t pt-4"
        tabIndex={0}
        aria-label="اقلام سفارش"
      >
        {cart.items.map((item) => (
          <li key={item.variantId} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-sm",
                  item.purchasable
                    ? "font-medium text-foreground"
                    : "text-muted-foreground line-through"
                )}
                title={item.product.title}
              >
                {item.product.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.variant ? `${item.variant.title} · ` : ""}
                {toFaDigits(item.quantity)} عدد
                {item.issues.includes("stock_exceeded") && (
                  <span className="ms-1 font-medium text-amber-700">
                    (تعداد اصلاح شد)
                  </span>
                )}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                item.purchasable ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.purchasable ? formatPriceToman(item.lineTotal) : "—"}
            </p>
          </li>
        ))}
      </ul>

      {/* Discount code — Phase 12 engine, server-validated */}
      {appliedDiscount ? (
        <div className="space-y-2 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--reyhan-green-700)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none">
              <path
                d="M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6l7-3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            کد تخفیف اعمال شد
          </p>
          <div className="flex items-center justify-between rounded-lg border border-[var(--reyhan-green-600)]/30 bg-[var(--reyhan-green-50)]/60 px-3 py-2.5">
            <span dir="ltr" className="truncate text-sm font-bold tabular-nums text-foreground">
              {appliedDiscount.code}
            </span>
            <button
              type="button"
              onClick={onRemoveDiscount}
              disabled={discountApplying || pending}
              className="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              حذف
            </button>
          </div>
          {freeShipping && (
            <p role="status" className="text-xs font-medium text-[var(--reyhan-green-700)]">
              هزینه ارسال این سفارش با کد تخفیف حذف می‌شود.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={onApplyDiscount} className="space-y-2 border-t pt-4">
          <label
            htmlFor="checkout-discount"
            className="block text-sm font-medium text-foreground"
          >
            کد تخفیف
          </label>
          <div className="flex gap-2">
            <input
              id="checkout-discount"
              name="discountCodeUI"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="در صورت داشتن کد تخفیف وارد کنید"
              value={discountCode}
              onChange={(e) => onDiscountCodeChange(e.target.value)}
              maxLength={64}
              disabled={discountApplying}
              aria-invalid={discountNoticeTone === "error" || undefined}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={discountApplying || !discountCode.trim()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discountApplying ? "در حال بررسی…" : "اعمال"}
            </button>
          </div>
        </form>
      )}

      {/* Discount status copy — Persian errors from the server engine */}
      {discountNotice && !appliedDiscount && (
        <p
          role={discountNoticeTone === "error" ? "alert" : "status"}
          className={cn(
            "text-xs leading-5",
            discountNoticeTone === "error"
              ? "font-medium text-destructive"
              : discountNoticeTone === "success"
                ? "font-medium text-[var(--reyhan-green-700)]"
                : "text-muted-foreground"
          )}
        >
          {discountNotice}
        </p>
      )}

      {/* Totals — server-validated only */}
      <dl className="space-y-2.5 border-t pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">مجموع کالاها</dt>
          <dd className={cn("font-semibold tabular-nums text-foreground", updating && "opacity-50")}>
            {formatPriceToman(discountedSubtotal)}
          </dd>
        </div>
        {appliedDiscount && (
          <div className="flex items-center justify-between text-[var(--reyhan-green-700)]">
            <dt>تخفیف</dt>
            <dd className="tabular-nums">
              {discountAmount > 0 ? `−${formatPriceToman(discountAmount)}` : freeShipping ? "ارسال رایگان" : "—"}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between text-muted-foreground/80">
          <dt>هزینه ارسال</dt>
          <dd className="text-xs">
            {freeShipping
              ? "رایگان (کد تخفیف)"
              : "در مرحله پرداخت اعلام می‌شود"}
          </dd>
        </div>
      </dl>

      {/* Final payable */}
      <div className="space-y-1 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">مبلغ قابل پرداخت</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums text-foreground",
              updating && "opacity-50"
            )}
          >
            {formatPriceToman(appliedDiscount ? discountedSubtotal - discountAmount : discountedSubtotal)}
          </span>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          مبلغ نهایی پیش از ثبت سفارش، یک بار دیگر در فروشگاه بررسی می‌شود.
        </p>
      </div>

      {/* Submit CTA */}
      <div className="space-y-2.5">
        <button
          type="submit"
          form="checkout-submit-form"
          disabled={!canSubmit || pending || updating}
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors",
            "hover:bg-[var(--reyhan-blue-700)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {pending ? "در حال ثبت سفارش…" : "ثبت سفارش و پرداخت"}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {!addressSelected && !updating && (
          <p role="status" className="text-[11px] font-medium text-amber-700">
            ابتدا نشانی ارسال را انتخاب کنید.
          </p>
        )}
        {updating && (
          <p role="status" className="text-[11px] text-muted-foreground">
            در حال به‌روزرسانی قیمت‌ها و موجودی…
          </p>
        )}
        <Link
          href="/cart"
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          بازگشت به سبد خرید
        </Link>
      </div>

      {/* Trust hint */}
      <div className="flex items-center gap-2 border-t pt-4 text-[11px] text-muted-foreground">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 shrink-0 text-[var(--reyhan-green-600)]"
          fill="none"
        >
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
        قیمت‌ها و موجودی کالاها پیش از ثبت نهایی دوباره بررسی می‌شوند.
      </div>
    </aside>
  );
}
