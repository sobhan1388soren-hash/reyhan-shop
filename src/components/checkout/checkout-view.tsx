"use client";

// Checkout view orchestrator — server-authoritative checkout UI.
// Mirrors the CartView pattern: reads the guest cart from localStorage,
// asks the server to re-validate prices/stock, and renders every state
// (loading, empty cart, no addresses, adding address, item issues,
// validation failure, submission failure, stale cart). The final submit
// sends only *wishes* (variant ids + quantities + selected ids); every
// price, total, stock, and ownership fact is recomputed server-side.

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import {
  validateCheckoutCartAction,
  applyCheckoutDiscountAction,
  submitCheckout,
} from "@/app/actions/checkout";
import type { CartValidationResult, ValidatedCartItem } from "@/lib/cart/types";
import type {
  CheckoutAddress,
  PaymentMethodOption,
  ShippingMethodOption,
} from "@/lib/checkout/types";
import { CheckoutSteps } from "./checkout-steps";
import { AddressSelector } from "./address-selector";
import { CheckoutSummary } from "./checkout-summary";
import type { AppliedDiscountPreview } from "./checkout-summary";

type Status = "loading" | "ready" | "error" | "empty";

type DiscountTone = "info" | "error" | "success";

function entriesKeyOf(entries: { variantId: string; quantity: number }[]): string {
  return entries.map((e) => `${e.variantId}:${e.quantity}`).join("|");
}

export function CheckoutView({
  addresses: initialAddresses,
  shippingMethods,
  paymentMethods,
  defaultAddressId,
}: {
  addresses: CheckoutAddress[];
  shippingMethods: ShippingMethodOption[];
  paymentMethods: PaymentMethodOption[];
  defaultAddressId: string | null;
}) {
  const router = useRouter();
  const { entries } = useCart();

  const [cart, setCart] = React.useState<CartValidationResult | null>(null);
  const [cartKey, setCartKey] = React.useState<string | null>(null);
  const [cartError, setCartError] = React.useState(false);

  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(
    defaultAddressId
  );
  const [shippingMethodId, setShippingMethodId] = React.useState<string | null>(
    shippingMethods.find((m) => m.selectable)?.id ?? null
  );
  const [paymentMethodId, setPaymentMethodId] = React.useState<string | null>(
    paymentMethods.find((m) => m.selectable)?.id ?? null
  );

  // ── Discount state (Phase 12) — all amounts server-derived ──────────
  const [discountInput, setDiscountInput] = React.useState("");
  const [appliedDiscount, setAppliedDiscount] = React.useState<AppliedDiscountPreview | null>(null);
  const [discountNotice, setDiscountNotice] = React.useState<string | null>(null);
  const [discountTone, setDiscountTone] = React.useState<DiscountTone>("info");
  const [discountApplying, setDiscountApplying] = React.useState(false);
  const [announced, setAnnounced] = React.useState("");

  const [submitState, submitAction, submitPending] = useActionState(submitCheckout, {
    status: "idle" as const,
  });

  const hasEntries = entries.length > 0;
  const entriesKey = React.useMemo(() => entriesKeyOf(entries), [entries]);
  const updating = cartKey !== entriesKey;

  const status: Status = cartError
    ? "error"
    : !hasEntries
      ? "empty"
      : cart === null
        ? "loading"
        : "ready";

  // ── Server re-validation whenever the stored cart changes ────────────
  React.useEffect(() => {
    if (cartKey === entriesKey) return;
    let cancelled = false;
    (async () => {
      const requestedKey = entriesKeyOf(entries);
      const outcome = await validateCheckoutCartAction(entries);
      if (cancelled) return;
      if (outcome.ok) {
        setCart(outcome.cart);
        setCartKey(requestedKey);
        setCartError(false);
      } else {
        setCartError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, entriesKey, cartKey]);

  // ── Post-submission outcomes ──────────────────────────────────────────
  const submittedRef = React.useRef(false);
  React.useEffect(() => {
    if (submitState.status === "idle" || submittedRef.current) return;
    submittedRef.current = true;
    // Success never lands here — the action hard-redirects to the order page.
  }, [submitState.status]);

  // ── Discount re-validation when the cart changes under an applied code ──
  // The server amount was computed for an earlier subtotal; when the cart
  // changes the preview is re-applied so the displayed amount always
  // matches the current server-validated cart (the server recomputes
  // everything; the client trusts only the response).
  const reapplyDiscount = React.useCallback(
    async (code: string) => {
      setDiscountApplying(true);
      try {
        const outcome = await applyCheckoutDiscountAction({
          entries,
          code,
          shippingMethodId,
        });
        if (outcome.ok) {
          setAppliedDiscount({
            code: outcome.code,
            amount: outcome.amount,
            freeShipping: outcome.freeShipping,
          });
          setDiscountTone("success");
          setDiscountNotice(null);
        } else {
          // The cart changed under the code (e.g. subtotal below the
          // minimum) — drop the preview and surface the Persian reason.
          setAppliedDiscount(null);
          setDiscountInput(code);
          setDiscountTone("error");
          setDiscountNotice(outcome.error);
        }
      } finally {
        setDiscountApplying(false);
      }
    },
    [entries, shippingMethodId]
  );

  const cartChangedSinceApply = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!appliedDiscount) {
      cartChangedSinceApply.current = null;
      return;
    }
    if (updating) {
      cartChangedSinceApply.current = entriesKey;
      return;
    }
    // Cart settled after a change — re-apply the code against the fresh
    // server subtotal.
    if (cartChangedSinceApply.current && cartChangedSinceApply.current !== entriesKey) {
      cartChangedSinceApply.current = null;
      void reapplyDiscount(appliedDiscount.code);
    }
  }, [entriesKey, updating, appliedDiscount, reapplyDiscount]);

  // Stale/invalid cart guard: if any item became unpurchasable, block the CTA.
  const blockedByCart =
    cart === null ||
    cart.items.length === 0 ||
    !cart.allPurchasable ||
    cart.purchasableCount === 0 ||
    updating;

  const canSubmit =
    !blockedByCart &&
    !submitPending &&
    selectedAddressId !== null &&
    shippingMethodId !== null &&
    paymentMethodId !== null;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleAddressAdded = (address: CheckoutAddress) => {
    setAddresses((prev) =>
      prev.some((a) => a.id === address.id) ? prev : [...prev, address]
    );
    setSelectedAddressId(address.id);
    setAnnounced("نشانی جدید ذخیره و برای این سفارش انتخاب شد.");
  };

  const handleApplyDiscount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = discountInput.trim();
    if (!code || discountApplying) return;
    setDiscountApplying(true);
    setDiscountNotice(null);
    setDiscountTone("info");

    void (async () => {
      try {
        const outcome = await applyCheckoutDiscountAction({
          entries,
          code,
          shippingMethodId,
        });
        if (outcome.ok) {
          setAppliedDiscount({
            code: outcome.code,
            amount: outcome.amount,
            freeShipping: outcome.freeShipping,
          });
          setDiscountInput(outcome.code);
          setDiscountTone("success");
          setDiscountNotice(null);
          setAnnounced(
            outcome.freeShipping
              ? `کد تخفیف «${outcome.code}» اعمال شد؛ هزینه ارسال این سفارش رایگان می‌شود.`
              : `کد تخفیف «${outcome.code}» اعمال شد.`
          );
        } else {
          setAppliedDiscount(null);
          setDiscountTone("error");
          setDiscountNotice(outcome.error);
          setAnnounced(outcome.error);
        }
      } catch {
        setDiscountTone("error");
        setDiscountNotice(
          "در حال حاضر امکان بررسی کد تخفیف وجود ندارد. لطفاً دوباره تلاش کنید."
        );
      } finally {
        setDiscountApplying(false);
      }
    })();
  };

  const handleRemoveDiscount = () => {
    if (discountApplying) return;
    setAppliedDiscount(null);
    setDiscountInput("");
    setDiscountNotice(null);
    setDiscountTone("info");
    setAnnounced("کد تخفیف حذف شد.");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!canSubmit) {
      e.preventDefault();
      if (selectedAddressId === null) {
        setAnnounced("ابتدا نشانی ارسال را انتخاب کنید.");
      } else if (blockedByCart) {
        setAnnounced("سبد خرید در حال به‌روزرسانی است؛ لطفاً منتظر بمانید.");
      }
      return;
    }
    // The server action re-validates everything; keep storage until success
    // redirect happens. The success page clears the cart.
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite" className="sr-only">
        {announced || (submitState.error ?? "")}
      </p>

      <CheckoutSteps currentStep="checkout" />

      {status === "error" && (
        <CartErrorState onRetry={() => router.refresh()} />
      )}

      {status === "empty" && <EmptyCartNotice />}

      {status === "loading" && <CheckoutSkeleton />}

      {status === "ready" && cart && (
        <form
          id="checkout-submit-form"
          action={submitAction}
          onSubmit={handleSubmit}
          className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8"
        >
          {/* Hidden authoritative inputs — values the server still re-validates */}
          <input type="hidden" name="cartEntries" value={JSON.stringify(entries)} />
          <input type="hidden" name="addressId" value={selectedAddressId ?? ""} />
          <input type="hidden" name="shippingMethodId" value={shippingMethodId ?? ""} />
          <input type="hidden" name="paymentMethodId" value={paymentMethodId ?? ""} />
          {/* The applied code rides along; the server re-validates everything */}
          {appliedDiscount && (
            <input type="hidden" name="discountCode" value={appliedDiscount.code} />
          )}

          {/* ── Main column: address → shipping → payment ─────────────── */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            {/* Server validation failure banner */}
            {submitState.error && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5"
              >
                <p className="text-sm font-medium text-destructive">{submitState.error}</p>
                {submitState.redirectToCart && (
                  <Link
                    href="/cart"
                    className="text-xs font-medium text-[var(--reyhan-blue-700)] hover:underline"
                  >
                    بازگشت به سبد خرید برای بررسی اقلام
                  </Link>
                )}
              </div>
            )}

            {/* 1) Address selection + inline add */}
            <AddressSelector
              addresses={addresses}
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
              onAddressAdded={handleAddressAdded}
            />

            {/* 2) Shipping */}
            <section
              aria-labelledby="checkout-shipping-heading"
              className="rounded-xl border bg-card p-5 shadow-card sm:p-6"
            >
              <h2 id="checkout-shipping-heading" className="text-base font-bold text-foreground">
                روش ارسال
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                روش ارسال سفارش را انتخاب کنید. هزینه نهایی ارسال در مرحله پرداخت و پس از
                تکمیل فرایند، از طریق پشتیبانی اعلام می‌شود.
              </p>
              <fieldset className="mt-4">
                <legend className="sr-only">روش ارسال</legend>
                <ul className="space-y-2.5">
                  {shippingMethods.map((method) => {
                    const checked = shippingMethodId === method.id;
                    return (
                      <li key={method.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                            checked
                              ? "border-primary bg-[var(--reyhan-blue-50)]/50"
                              : "bg-background hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="shippingChoice"
                            value={method.id}
                            checked={checked}
                            disabled={!method.selectable}
                            onChange={() => setShippingMethodId(method.id)}
                            className="mt-1 size-4 accent-[var(--reyhan-blue-600)]"
                          />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {method.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {method.description}
                            </span>
                            <span className="mt-1.5 block text-xs font-medium text-[var(--reyhan-blue-700)]">
                              {method.cost === null
                                ? "هزینه ارسال: در مرحله پرداخت اعلام می‌شود"
                                : formatPriceToman(method.cost)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </section>

            {/* 3) Payment method */}
            <section
              aria-labelledby="checkout-payment-heading"
              className="rounded-xl border bg-card p-5 shadow-card sm:p-6"
            >
              <h2 id="checkout-payment-heading" className="text-base font-bold text-foreground">
                روش پرداخت
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                روش پرداخت سفارش را انتخاب کنید.
              </p>
              <fieldset className="mt-4">
                <legend className="sr-only">روش پرداخت</legend>
                <ul className="space-y-2.5">
                  {paymentMethods.map((method) => {
                    const checked = paymentMethodId === method.id;
                    return (
                      <li key={method.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                            checked
                              ? "border-primary bg-[var(--reyhan-blue-50)]/50"
                              : "bg-background hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="paymentChoice"
                            value={method.id}
                            checked={checked}
                            disabled={!method.selectable}
                            onChange={() => setPaymentMethodId(method.id)}
                            className="mt-1 size-4 accent-[var(--reyhan-blue-600)]"
                          />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {method.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {method.description}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </section>

            {/* Cart issue warnings — never silently continue */}
            {(cart.hasIssues || !cart.allPurchasable) && (
              <CartIssuesNotice items={cart.items} />
            )}
          </div>

          {/* ── Summary column (sticky on desktop) ───────────────────── */}
          <div className="lg:col-span-5 xl:col-span-4">
            <CheckoutSummary
              cart={cart}
              updating={updating}
              pending={submitPending}
              discountCode={discountInput}
              onDiscountCodeChange={setDiscountInput}
              onApplyDiscount={handleApplyDiscount}
              onRemoveDiscount={handleRemoveDiscount}
              appliedDiscount={appliedDiscount}
              discountNotice={discountNotice}
              discountNoticeTone={discountTone}
              discountApplying={discountApplying}
              canSubmit={canSubmit}
              addressSelected={selectedAddressId !== null}
            />
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sub-states ─────────────────────────────────────────────────────────

function EmptyCartNotice() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border bg-card px-6 py-14 text-center shadow-card">
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--reyhan-blue-50)]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-[var(--reyhan-blue-600)]" fill="none">
          <path
            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="17.5" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-foreground">سبد خرید شما خالی است</h2>
      <p className="max-w-sm text-sm leading-7 text-muted-foreground">
        برای تسویه حساب، ابتدا کالاهای مورد نیاز خود را به سبد خرید اضافه کنید.
      </p>
      <Link
        href="/products"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
      >
        مشاهده محصولات
      </Link>
    </div>
  );
}

function CartErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-10 text-destructive" fill="none">
        <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <h2 className="text-base font-bold text-foreground">خطا در بررسی سبد خرید</h2>
      <p className="max-w-sm text-sm leading-7 text-muted-foreground">
        در حال حاضر امکان بررسی سبد خرید شما وجود ندارد. کالاهای شما ذخیره می‌مانند؛
        لطفاً دوباره تلاش کنید.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

function CartIssuesNotice({ items }: { items: ValidatedCartItem[] }) {
  const problemItems = items.filter((i) => !i.purchasable || i.issues.length > 0);
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-700">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none">
          <path
            d="M12 8.5v5M12 16.5v.01"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M10.3 4.2L2.8 17.5a1.5 1.5 0 0 0 1.3 2.3h15.8a1.5 1.5 0 0 0 1.3-2.3L13.7 4.2a1.5 1.5 0 0 0-2.6 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        وضعیت برخی کالاهای سبد شما تغییر کرده است
      </p>
      <ul className="mt-2 space-y-1.5">
        {problemItems.map((item) => (
          <li key={item.variantId} className="text-xs leading-6 text-amber-700">
            «{item.product.title}» —{" "}
            {item.issues.includes("variant_removed")
              ? "از فروشگاه حذف شده است"
              : item.issues.includes("product_unavailable")
                ? "در حال حاضر عرضه نمی‌شود"
                : item.issues.includes("variant_inactive")
                  ? "گزینه انتخابی غیرفعال شده است"
                  : item.issues.includes("out_of_stock")
                    ? "موجودی به پایان رسیده است"
                    : item.issues.includes("stock_exceeded")
                      ? `تعداد به ${toFaDigits(item.quantity)} عدد کاهش یافت`
                      : item.issues.includes("price_changed")
                        ? "قیمت تغییر کرده و قیمت جدید اعمال می‌شود"
                        : "باید بررسی شود"}
            .
          </li>
        ))}
      </ul>
      <Link
        href="/cart"
        className="mt-3 inline-flex text-xs font-semibold text-amber-800 underline underline-offset-4"
      >
        بازگشت به سبد خرید برای رفع مشکل
      </Link>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری تسویه حساب" className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-6">
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="mt-4 h-20 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-xl border bg-card p-6 lg:col-span-5 xl:col-span-4">
          <div className="h-5 w-28 rounded bg-muted" />
          <div className="mt-5 h-4 w-full rounded bg-muted" />
          <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
          <div className="mt-6 h-12 w-full rounded bg-muted" />
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground">در حال بارگذاری تسویه حساب…</p>
    </div>
  );
}
