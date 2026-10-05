"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  formatPriceToman,
  toFaDigits,
} from "@/lib/catalog/format";
import {
  getVariantAvailability,
  availabilityLabel,
  isPurchasable,
} from "@/lib/catalog/availability";
import type { CatalogVariant, AvailabilityState } from "@/lib/catalog/types";
import { useCart } from "@/hooks/use-cart";
import { openCartDrawer } from "@/components/cart/cart-drawer";

type PurchasePanelProps = {
  productTitle: string;
  variants: CatalogVariant[];
  defaultVariantId?: string;
};

type Feedback = { kind: "success" | "error"; message: string } | null;

export function PurchasePanel({
  productTitle,
  variants,
  defaultVariantId,
}: PurchasePanelProps) {
  const initialId =
    defaultVariantId ?? variants.find((v) => v.isDefault && v.isActive)?.id ?? variants[0]?.id;
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialId);
  const [quantityInput, setQuantityInput] = React.useState(1);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const { addToCart } = useCart();

  // Resolve the effective selection during render: if the selected variant
  // is inactive, fall back to the first active one without an effect.
  const resolvedId =
    variants.find((v) => v.id === selectedId && v.isActive)?.id ??
    variants.find((v) => v.isActive)?.id;
  const selected = variants.find((v) => v.id === resolvedId);
  const availability = selected ? getVariantAvailability(selected) : "unavailable";
  const purchasable = selected ? isPurchasable(availability) && selected.isActive : false;
  const availableStock = selected?.inventory
    ? Math.max(0, selected.inventory.quantity - selected.inventory.reservedQuantity)
    : 0;
  const maxQuantity = purchasable ? Math.max(1, availableStock) : 1;

  // Clamp quantity against the current variant's stock during render.
  const quantity = Math.min(Math.max(1, quantityInput), maxQuantity);

  const optionRefs = React.useRef(new Map<string, HTMLButtonElement>());

  // APG radiogroup keyboard pattern (RTL-aware: ArrowLeft moves forward).
  // Disabled (inactive) options are skipped, matching native radio behavior.
  const onOptionKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const enabled = variants.filter((v) => v.isActive);
    if (enabled.length === 0) return;
    const ids = enabled.map((v) => v.id);
    const current = ids.includes(id) ? id : resolvedId;
    const i = Math.max(0, ids.indexOf(current ?? ""));
    let next: string = ids[0]!;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length]!;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length]!;
    else if (e.key === "End") next = ids[ids.length - 1]!;
    setSelectedId(next);
    setFeedback(null);
    optionRefs.current.get(next)?.focus();
  };

  const handleAddToCart = () => {
    if (!selected || !purchasable || quantity < 1) {
      setFeedback({ kind: "error", message: "این گزینه در حال حاضر قابل خرید نیست." });
      return;
    }
    const ok = addToCart(selected.id, quantity, selected.price);
    if (ok) {
      setFeedback({
        kind: "success",
        message: `«${productTitle}» با موفقیت به سبد خرید اضافه شد.`,
      });
      openCartDrawer();
    } else {
      setFeedback({
        kind: "error",
        message: "خطا در افزودن به سبد خرید. لطفاً دوباره تلاش کنید.",
      });
    }
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5 shadow-card sm:p-6">
      {/* Variant selection */}
      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-foreground">
            انتخاب گزینه
            {variants.length > 1 && (
              <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                ({toFaDigits(variants.length)} مدل)
              </span>
            )}
          </legend>
          <div
            className={cn(
              "grid gap-2",
              variants.length <= 2 ? "sm:grid-cols-2" : "grid-cols-1"
            )}
            role="radiogroup"
            aria-label="انتخاب مدل محصول"
          >
            {variants.map((variant) => {
              const isSelected = variant.id === resolvedId;
              const vAvailability = getVariantAvailability(variant);
              const vPurchasable = variant.isActive && isPurchasable(vAvailability);
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  ref={(el) => {
                    if (el) optionRefs.current.set(variant.id, el);
                    else optionRefs.current.delete(variant.id);
                  }}
                  disabled={!variant.isActive}
                  onClick={() => {
                    setSelectedId(variant.id);
                    setFeedback(null);
                  }}
                  onKeyDown={(e) => onOptionKeyDown(e, variant.id)}
                  className={cn(
                    "flex flex-col rounded-lg border px-3 py-2.5 text-start transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : variant.isActive
                        ? "border-input bg-background hover:bg-accent"
                        : "cursor-not-allowed border-muted/50 opacity-50"
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {variant.title}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatPriceToman(variant.price)}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex size-1.5 rounded-full",
                        vPurchasable
                          ? vAvailability === "low_stock"
                            ? "bg-amber-500"
                            : "bg-[var(--reyhan-green-500)]"
                          : "bg-muted-foreground/40"
                      )}
                    />
                    {availabilityLabel(vAvailability)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Price + SKU */}
      {selected && (
        <div
          className="flex flex-wrap items-end justify-between gap-3 border-t pt-4"
          role="status"
          aria-live="polite"
        >
          <div>
            <p className="text-xs text-muted-foreground">قیمت انتخاب شما</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatPriceToman(selected.price)}
            </p>
            {selected.compareAtPrice != null && selected.compareAtPrice > selected.price && (
              <p className="mt-1 text-sm tabular-nums text-muted-foreground line-through">
                {formatPriceToman(selected.compareAtPrice)}
              </p>
            )}
          </div>
          <div className="text-end">
            <p className="text-xs text-muted-foreground">کد کالا</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground" dir="ltr">
              {selected.sku}
            </p>
          </div>
        </div>
      )}

      {/* Availability + stock */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            purchasable
              ? vAvailabilityClass(availability)
              : "bg-secondary text-secondary-foreground"
          )}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
          {availabilityLabel(availability)}
        </span>
        {purchasable && selected?.inventory && availableStock > 0 && (
          <span className="text-xs text-muted-foreground">
            {toFaDigits(availableStock)} عدد در انبار
          </span>
        )}
      </div>

      {/* Quantity + Add to cart */}
      <div className="flex flex-col gap-3">
        <div className="flex items-stretch justify-between gap-3">
          {/* group (not label/output): output is not a labelable element,
              so the stepper is exposed as a named group instead. */}
          <div role="group" aria-labelledby="quantity-label">
            <span id="quantity-label" className="mb-1.5 block text-sm font-medium text-foreground">
              تعداد
            </span>
            <div className="flex h-11 items-center rounded-md border border-input bg-background">
              <button
                type="button"
                aria-label="کاهش تعداد"
                onClick={() => setQuantityInput((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="inline-flex size-11 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                −
              </button>
              <output
                aria-live="polite"
                className="w-12 text-center text-base font-semibold tabular-nums text-foreground"
              >
                {toFaDigits(quantity)}
              </output>
              <button
                type="button"
                aria-label="افزایش تعداد"
                onClick={() => setQuantityInput((q) => Math.min(maxQuantity, q + 1))}
                disabled={!purchasable || quantity >= maxQuantity}
                className="inline-flex size-11 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                +
              </button>
            </div>
            {purchasable && availableStock > 0 && availableStock <= 5 && (
              <p className="mt-1.5 text-[11px] text-amber-700">
                تنها {toFaDigits(availableStock)} عدد باقی مانده است
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!purchasable}
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-semibold shadow-sm transition-colors",
            purchasable
              ? "bg-primary text-primary-foreground hover:bg-[var(--reyhan-blue-700)] active:bg-[var(--reyhan-blue-800)]"
              : "cursor-not-allowed bg-secondary text-muted-foreground"
          )}
          aria-live="polite"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
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
          {purchasable ? "افزودن به سبد خرید" : "فعلاً قابل خرید نیست"}
        </button>

        {/* Mobile sticky purchase hint — CTA also lives in sticky bar */}
        <Link
          href="/contact"
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          مشاوره رایگان قبل از خرید
        </Link>
      </div>

      {/* Feedback */}
      {feedback && (
        <p
          role="status"
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            feedback.kind === "success"
              ? "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function vAvailabilityClass(state: AvailabilityState): string {
  switch (state) {
    case "low_stock":
      return "bg-amber-50 text-amber-700";
    case "in_stock":
      return "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]";
    case "out_of_stock":
    case "unavailable":
      return "bg-secondary text-secondary-foreground";
  }
}
