"use client";

// Frosted Glass Cart Drawer — lightweight slide-over sheet, zero animation libs.
// Pure CSS transitions only (opacity + transform), full RTL via logical
// properties (`start-0`, `border-e`, `ms-*/me-*`). Rendered once from SiteShell;
// opens via `openCartDrawer()` (header button, add-to-cart) and closes via
// ESC, backdrop click, or the X button. Returns null when fully closed so the
// closed drawer costs zero DOM nodes (SEO/performance safe).
//
// Prices shown here are UX snapshots until the server validation lands —
// authoritative totals always come from `validateCartAction`, mirroring
// CartView. The free-shipping threshold below is a storefront UX constant.

import * as React from "react";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { validateCartAction } from "@/app/actions/cart";
import type { CartValidationResult } from "@/lib/cart/types";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

// ── Free-shipping progress ──────────────────────────────────────────────
// Threshold: 2,000,000 Tomans = 20,000,000 Rial (prices are stored in Rial).
// Single source of truth for the drawer's progress bar.

export const FREE_SHIPPING_THRESHOLD_RIAL = 20_000_000;

export type FreeShippingProgress = {
  /** Authoritative-or-estimated subtotal in Rial. */
  subtotal: number;
  /** Remaining Rial to reach the threshold (0 when achieved). */
  remaining: number;
  /** 0–100, clamped. Drives the bar width. */
  percent: number;
  /** True when subtotal meets/exceeds the threshold. */
  achieved: boolean;
};

export function getFreeShippingProgress(subtotalRial: unknown): FreeShippingProgress {
  const subtotal =
    typeof subtotalRial === "number" && Number.isFinite(subtotalRial)
      ? Math.max(0, Math.round(subtotalRial))
      : 0;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_RIAL - subtotal);
  const percent = Math.min(
    100,
    (subtotal / FREE_SHIPPING_THRESHOLD_RIAL) * 100
  );
  return { subtotal, remaining, percent, achieved: remaining === 0 };
}

// ── Open/close bus ───────────────────────────────────────────────────────
// Window-event bus (no context provider needed): any client component can
// call `openCartDrawer()` without prop drilling. SSR-safe (window guards).

export const CART_DRAWER_OPEN_EVENT = "reyhan:cart-drawer:open";
export const CART_DRAWER_CLOSE_EVENT = "reyhan:cart-drawer:close";

export function openCartDrawer(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_DRAWER_OPEN_EVENT));
}

function entriesKeyOf(entries: { variantId: string; quantity: number }[]): string {
  return entries.map((e) => `${e.variantId}:${e.quantity}`).join("|");
}

function estimateSubtotal(
  entries: { quantity: number; priceSnapshot?: number | null }[]
): number {
  return entries.reduce((sum, e) => {
    const unit =
      typeof e.priceSnapshot === "number" && Number.isFinite(e.priceSnapshot)
        ? Math.max(0, Math.round(e.priceSnapshot))
        : 0;
    return sum + unit * e.quantity;
  }, 0);
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { entries, count, updateQuantity, removeFromCart } = useCart();
  const [open, setOpen] = React.useState(false);
  // `rendered` keeps the node mounted during the exit transition;
  // `entered` flips to true on the next frame to trigger CSS transitions.
  const [rendered, setRendered] = React.useState(false);
  const [entered, setEntered] = React.useState(false);

  const [result, setResult] = React.useState<CartValidationResult | null>(null);
  const [resultKey, setResultKey] = React.useState<string | null>(null);
  const [pendingVariant, setPendingVariant] = React.useState<string | null>(null);
  const [announced, setAnnounced] = React.useState("");

  const panelRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);
  const enterTimerRef = React.useRef<number | null>(null);
  const exitTimerRef = React.useRef<number | null>(null);

  const entriesKey = React.useMemo(() => entriesKeyOf(entries), [entries]);
  const hasEntries = entries.length > 0;
  const updating = resultKey !== entriesKey;

  // Server truth when fresh; local price-snapshot estimate while validating
  // (instant progress bar, never blocks on the network).
  const displaySubtotal =
    !hasEntries || result === null || updating
      ? hasEntries && (result === null || updating)
        ? (result && !updating ? result.subtotal : estimateSubtotal(entries))
        : 0
      : result.subtotal;
  const progress = getFreeShippingProgress(displaySubtotal);

  const close = React.useCallback(() => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(CART_DRAWER_CLOSE_EVENT));
  }, []);

  // Open/close event subscriptions — no state updates in cleanup bodies.
  React.useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    window.addEventListener(CART_DRAWER_OPEN_EVENT, handleOpen);
    window.addEventListener(CART_DRAWER_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(CART_DRAWER_OPEN_EVENT, handleOpen);
      window.removeEventListener(CART_DRAWER_CLOSE_EVENT, handleClose);
    };
  }, []);

  // Mount/unmount choreography for enter/exit CSS transitions.
  React.useEffect(() => {
    if (open) {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRendered(true);
      enterTimerRef.current = window.setTimeout(() => setEntered(true), 20);
    } else if (rendered) {
      setEntered(false);
      exitTimerRef.current = window.setTimeout(() => setRendered(false), 320);
    }
    // `rendered` is intentionally read here to schedule the exit transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  // Timer cleanup only.
  React.useEffect(() => {
    return () => {
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Body scroll lock while the sheet is mounted.
  React.useEffect(() => {
    if (!rendered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  // Move focus into the sheet on open; restore the trigger on close.
  React.useEffect(() => {
    if (rendered && entered) closeButtonRef.current?.focus();
    if (!rendered && previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus?.();
      previouslyFocusedRef.current = null;
    }
  }, [rendered, entered]);

  // ESC to close (attached only while mounted).
  React.useEffect(() => {
    if (!rendered) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [rendered, close]);

  // Server re-validation whenever the stored entries change (same
  // external-system subscription pattern as CartView).
  React.useEffect(() => {
    if (!rendered || resultKey === entriesKey) return;
    let cancelled = false;
    (async () => {
      const requestedKey = entriesKeyOf(entries);
      const outcome = await validateCartAction(entries);
      if (cancelled) return;
      if (outcome.ok) {
        setResult(outcome.cart);
        setResultKey(requestedKey);
        setPendingVariant(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rendered, entries, entriesKey, resultKey]);

  // Minimal focus trap: keep Tab cycling inside the sheet.
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
      setAnnounced("به‌روزرسانی سبد خرید ممکن نشد. لطفاً دوباره تلاش کنید.");
      return;
    }
    setAnnounced(`تعداد «${item.product.title}» به ${toFaDigits(clamped)} عدد تغییر کرد.`);
  };

  const handleRemove = (variantId: string) => {
    if (!result) return;
    const item = result.items.find((i) => i.variantId === variantId);
    const ok = removeFromCart(variantId);
    if (!ok) {
      setAnnounced("حذف کالا ممکن نشد. لطفاً دوباره تلاش کنید.");
      return;
    }
    if (item) setAnnounced(`«${item.product.title}» از سبد خرید حذف شد.`);
  };

  if (!rendered) return null;

  const items = result?.items ?? [];
  const showSkeleton = hasEntries && result === null;
  const showItems = hasEntries && !showSkeleton;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={undefined}>
      {/* Crystal blur backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={cn(
          "absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Slide-over panel — start side (right in Persian RTL) */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={hasEntries ? `سبد خرید — ${toFaDigits(count)} قلم کالا` : "سبد خرید"}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-full max-w-md bg-white/90 backdrop-blur-2xl border-e border-white/80",
          "shadow-[0_20px_50px_rgba(4,46,58,0.25)] flex flex-col transition-transform duration-300 ease-out",
          "motion-reduce:transition-none",
          entered
            ? "translate-x-0"
            : "rtl:translate-x-full ltr:-translate-x-full"
        )}
      >
        {/* Screen-reader live region for quantity/remove updates */}
        <p role="status" aria-live="polite" className="sr-only">
          {announced}
        </p>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/60 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">
            سبد خرید
            {hasEntries && (
              <span className="ms-2 rounded-full bg-[var(--reyhan-blue-50)] px-2.5 py-0.5 text-xs font-bold text-[var(--reyhan-blue-700)]">
                {toFaDigits(count)} کالا
              </span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="بستن سبد خرید"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 text-slate-500 transition-colors hover:border-cyan-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d="M3 4L13 12M13 4L3 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Free-shipping progress */}
        {hasEntries && (
          <div className="border-b border-white/60 px-5 py-4">
            <p aria-live="polite" className="text-[13px] font-semibold leading-6 text-foreground">
              {progress.achieved ? (
                <>
                  تبریک! سفارش شما شامل{" "}
                  <span className="text-[var(--reyhan-emerald-ink)]">ارسال رایگان</span> شد 🎉
                </>
              ) : (
                <>
                  فقط{" "}
                  <span className="text-[var(--reyhan-emerald-ink)]">
                    {formatPriceToman(progress.remaining)}
                  </span>{" "}
                  دیگر تا ارسال رایگان!
                </>
              )}
            </p>
            <div
              role="progressbar"
              aria-label="پیشرفت تا ارسال رایگان"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.percent)}
              className="mt-2.5 h-2.5 rounded-full bg-slate-100 overflow-hidden"
              dir="rtl"
            >
              <div
                aria-hidden="true"
                style={{ width: `${progress.percent}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#00f5a0] shadow-[0_0_12px_rgba(0,245,160,0.6)] transition-all duration-500 motion-reduce:transition-none"
              />
            </div>
            {!progress.achieved && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                آستانه ارسال رایگان {formatPriceToman(FREE_SHIPPING_THRESHOLD_RIAL)} است.
              </p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasEntries ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/50 px-6 py-14 text-center backdrop-blur-xl">
              <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#22d3ee]/15 to-[#00f5a0]/15 text-[var(--reyhan-blue-600)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8" fill="none">
                  <path
                    d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 11.4C9.5 11.4 10.4 12 11.2 12"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </svg>
              </span>
              <p className="mt-4 text-base font-bold text-foreground">سبد خرید شما خالی است</p>
              <p className="mt-1.5 max-w-xs text-[13px] leading-6 text-muted-foreground">
                هنوز کالایی انتخاب نکرده‌اید؛ از میان محصولات ریحان شروع کنید.
              </p>
              <Link
                href="/products"
                onClick={close}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] px-7 text-sm font-bold text-[#042e3a] shadow-[0_0_20px_-4px_rgba(0,245,160,0.5)] transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                مشاهده محصولات
              </Link>
            </div>
          ) : showSkeleton ? (
            <ul className="space-y-3" aria-label="در حال بارگذاری اقلام سبد">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="flex animate-pulse gap-3 rounded-2xl border border-slate-200/60 bg-white/60 p-3"
                >
                  <div className="size-16 shrink-0 rounded-xl bg-slate-200/80" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-2/3 rounded bg-slate-200/80" />
                    <div className="h-3 w-1/3 rounded bg-slate-200/80" />
                    <div className="h-8 w-28 rounded bg-slate-200/80" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={cn("space-y-3", updating && "opacity-70")} aria-label="اقلام سبد خرید">
              {items.map((item) => {
                const pending = updating || pendingVariant === item.variantId;
                return (
                  <li
                    key={item.variantId}
                    aria-busy={pending || undefined}
                    className="bg-white/60 border border-slate-200/60 rounded-2xl p-3 flex gap-3 shadow-sm hover:border-cyan-300 transition-colors"
                  >
                    {/* Crystal-framed thumbnail */}
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white/80 bg-white/80 shadow-sm">
                      {item.product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.product.image.url}
                          alt={item.product.image.alt}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-slate-300">
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
                            <path
                              d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[13px] font-semibold leading-6 text-foreground">
                          {item.product.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.variantId)}
                          disabled={pending}
                          aria-label={`حذف «${item.product.title}» از سبد خرید`}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                            <path
                              d="M2.5 4h11M6.5 2.5h3M4 4l.7 8.2a1.5 1.5 0 0 0 1.5 1.3h3.6a1.5 1.5 0 0 0 1.5-1.3L12 4M6.5 7v3.5M9.5 7v3.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      {item.variant && (
                        <p className="text-[11px] text-muted-foreground">گزینه: {item.variant.title}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        {/* Quantity stepper */}
                        <div className="inline-flex h-8 items-center rounded-xl border border-slate-200/80 bg-white/80">
                          <button
                            type="button"
                            aria-label={`افزایش تعداد «${item.product.title}»`}
                            onClick={() => handleQuantityChange(item.variantId, item.quantity + 1)}
                            disabled={pending || !item.purchasable || item.quantity >= item.maxQuantity}
                            className="inline-flex size-8 items-center justify-center text-base text-slate-600 transition hover:text-foreground disabled:opacity-35"
                          >
                            +
                          </button>
                          <output
                            aria-live="polite"
                            aria-label={`تعداد «${item.product.title}»`}
                            className="w-8 text-center text-[13px] font-bold tabular-nums text-foreground"
                          >
                            {toFaDigits(item.quantity)}
                          </output>
                          <button
                            type="button"
                            aria-label={`کاهش تعداد «${item.product.title}»`}
                            onClick={() => handleQuantityChange(item.variantId, item.quantity - 1)}
                            disabled={pending || item.quantity <= 1}
                            className="inline-flex size-8 items-center justify-center text-base text-slate-600 transition hover:text-foreground disabled:opacity-35"
                          >
                            −
                          </button>
                        </div>
                        <p className="text-[13px] font-bold tabular-nums text-foreground">
                          {formatPriceToman(item.purchasable ? item.lineTotal : item.unitPrice)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sticky footer */}
        {hasEntries && (
          <div className="border-t border-white/60 bg-white/70 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">جمع سبد خرید</span>
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "text-base font-bold tabular-nums text-foreground",
                  updating && "opacity-50"
                )}
              >
                {formatPriceToman(displaySubtotal)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              هزینه ارسال و تخفیف‌ها در مرحله تسویه‌حساب محاسبه می‌شود.
            </p>
            <Link
              href="/checkout"
              onClick={close}
              className="bg-[#042e3a] hover:bg-[#083f52] text-white shadow-[0_8px_20px_-4px_rgba(4,46,58,0.4)] hover:shadow-[0_8px_24px_-4px_rgba(34,211,238,0.5)] rounded-2xl py-3.5 font-bold transition-all w-full flex items-center justify-center gap-2 mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ادامه و پرداخت
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
            <Link
              href="/cart"
              onClick={close}
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/60 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-cyan-300 hover:bg-white/90"
            >
              مشاهده سبد خرید و تسویه حساب
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
