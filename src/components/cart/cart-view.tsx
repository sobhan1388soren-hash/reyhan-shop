"use client";

// Cart view orchestrator — reads the guest cart from localStorage, sends it
// to the server action for authoritative validation, and renders every cart
// state (loading, empty, error, price-change, stock-change, unavailable).
// Mutations update local storage first, then re-validate against the server;
// the previous validated result stays visible (with an updating indicator)
// until the fresh server response lands.

import * as React from "react";
import { useCart } from "@/hooks/use-cart";
import { validateCartAction } from "@/app/actions/cart";
import type { CartValidationResult } from "@/lib/cart/types";
import { toFaDigits } from "@/lib/catalog/format";
import { CartItemCard } from "@/components/cart/cart-item-card";
import { CartSummary } from "@/components/cart/cart-summary";
import { CartEmptyState } from "@/components/cart/cart-empty-state";

type Status = "loading" | "ready" | "error";

const RESTORED_NOTICE_MS = 5000;

function entriesKeyOf(entries: { variantId: string; quantity: number }[]): string {
  return entries.map((e) => `${e.variantId}:${e.quantity}`).join("|");
}

export function CartView() {
  const { entries, updateQuantity, switchVariant, removeFromCart } = useCart();

  const [result, setResult] = React.useState<CartValidationResult | null>(null);
  const [resultKey, setResultKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [pendingVariant, setPendingVariant] = React.useState<string | null>(null);
  const [announced, setAnnounced] = React.useState("");
  const [restoredNotice, setRestoredNotice] = React.useState(false);

  const firstValidationRef = React.useRef(false);
  const noticeTimerRef = React.useRef<number | null>(null);

  const hasEntries = entries.length > 0;
  const entriesKey = React.useMemo(() => entriesKeyOf(entries), [entries]);

  // Derived during render — no state effects.
  // "updating" = a validation for the current entries is still in flight.
  const updating = resultKey !== entriesKey;
  const status: Status = error
    ? "error"
    : !hasEntries
      ? "ready" // empty local cart → empty state without a server round-trip
      : result === null
        ? "loading"
        : "ready";

  // Timer cleanup only — no state updates in the effect body.
  React.useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const announce = React.useCallback((message: string) => {
    setAnnounced(message);
  }, []);

  // Re-validate whenever the stored entries change. All state updates happen
  // in the async continuation (external-system subscription pattern).
  React.useEffect(() => {
    if (resultKey === entriesKey) return;

    let cancelled = false;
    (async () => {
      const requestedKey = entriesKeyOf(entries);
      const outcome = await validateCartAction(entries);
      if (cancelled) return;
      if (outcome.ok) {
        setResult(outcome.cart);
        setResultKey(requestedKey);
        setError(false);
        setPendingVariant(null);
        if (!firstValidationRef.current) {
          firstValidationRef.current = true;
          if (entries.length > 0) {
            setRestoredNotice(true);
            noticeTimerRef.current = window.setTimeout(
              () => setRestoredNotice(false),
              RESTORED_NOTICE_MS
            );
          }
        }
      } else {
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, entriesKey, resultKey]);

  const handleQuantityChange = (variantId: string, nextQuantity: number) => {
    if (!result) return;
    const item = result.items.find((i) => i.variantId === variantId);
    if (!item || !item.purchasable) return;
    const clamped = Math.min(Math.max(1, nextQuantity), item.maxQuantity);
    if (clamped === item.quantity) return;

    setPendingVariant(variantId);
    const ok = updateQuantity(variantId, clamped);
    if (!ok) {
      setPendingVariant(null);
      announce("به‌روزرسانی سبد خرید ممکن نشد. لطفاً دوباره تلاش کنید.");
      return;
    }
    announce(`تعداد «${item.product.title}» به ${toFaDigits(clamped)} عدد تغییر کرد.`);
  };

  const handleVariantSwitch = (fromVariantId: string, toVariantId: string) => {
    if (!result) return;
    const item = result.items.find((i) => i.variantId === fromVariantId);
    if (!item || fromVariantId === toVariantId) return;
    setPendingVariant(fromVariantId);
    const ok = switchVariant(fromVariantId, toVariantId);
    if (!ok) {
      setPendingVariant(null);
      announce("تغییر گزینه ممکن نشد. لطفاً دوباره تلاش کنید.");
      return;
    }
    announce(
      `گزینه «${item.product.title}» تغییر کرد؛ قیمت و موجودی دوباره بررسی می‌شود.`
    );
  };

  const handleRemove = (variantId: string) => {
    if (!result) return;
    const item = result.items.find((i) => i.variantId === variantId);
    if (!item) return;
    setPendingVariant(variantId);
    const ok = removeFromCart(variantId);
    if (!ok) {
      setPendingVariant(null);
      announce("حذف کالا ممکن نشد. لطفاً دوباره تلاش کنید.");
      return;
    }
    announce(`«${item.product.title}» از سبد خرید حذف شد.`);
  };

  const handleRetry = () => {
    setError(false);
    setResult(null);
    setResultKey(null); // forces the validation effect to re-run
  };

  return (
    <div className="space-y-6">
      {/* Screen-reader live region for cart updates */}
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>

      {status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-10 text-destructive" fill="none">
            <path
              d="M12 8v5M12 16.5v.01"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h2 className="text-base font-bold text-foreground">خطا در بارگذاری سبد خرید</h2>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            در حال حاضر امکان بررسی سبد خرید شما وجود ندارد. اتصال خود را بررسی
            کنید و دوباره تلاش کنید. کالاهای شما ذخیره می‌مانند و از بین نمی‌روند.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {status === "loading" && (
        <div role="status" aria-label="در حال بارگذاری سبد خرید">
          <CartSkeleton />
        </div>
      )}

      {status === "ready" && !hasEntries && <CartEmptyState />}

      {status === "ready" && hasEntries && (
        <>
          {restoredNotice && (
            <p className="rounded-md bg-[var(--reyhan-green-50)] px-4 py-2.5 text-xs font-medium text-[var(--reyhan-green-700)]">
              سبد خرید شما بازیابی و اطلاعات آن با قیمت‌های به‌روز فروشگاه به‌روزرسانی شد.
            </p>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Items — main side (right column in RTL on desktop) */}
            <div className="lg:col-span-8 xl:col-span-9">
              <ul className="space-y-4">
                {result?.items.map((item) => (
                  <CartItemCard
                    key={item.variantId}
                    item={item}
                    pending={updating || pendingVariant === item.variantId}
                    onQuantityChange={handleQuantityChange}
                    onVariantSwitch={handleVariantSwitch}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            </div>

            {/* Summary — secondary side (left column in RTL on desktop) */}
            <div className="lg:col-span-4 xl:col-span-3">
              <CartSummary cart={result ?? emptySummary()} updating={updating} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function emptySummary(): CartValidationResult {
  return {
    items: [],
    subtotal: 0,
    totalCount: 0,
    purchasableCount: 0,
    allPurchasable: true,
    hasIssues: false,
  };
}

function CartSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row"
        >
          <div className="size-24 shrink-0 rounded-lg bg-muted" />
          <div className="flex-1 space-y-3 py-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/4 rounded bg-muted" />
            <div className="h-9 w-40 rounded bg-muted" />
          </div>
        </div>
      ))}
      <div className="animate-pulse rounded-xl border bg-card p-5">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="mt-4 h-3 w-full rounded bg-muted" />
        <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
        <div className="mt-5 h-12 w-full rounded bg-muted" />
      </div>
      <p className="text-center text-sm text-muted-foreground">در حال بارگذاری سبد خرید…</p>
    </>
  );
}
