"use client";

// Cart item card — product image, variant switching, quantity stepper,
// server-validated prices, availability warnings, remove action.
// All values (price, stock, totals) come from server validation only.

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { availabilityLabel } from "@/lib/catalog/availability";
import type { ValidatedCartItem } from "@/lib/cart/types";

type CartItemCardProps = {
  item: ValidatedCartItem;
  pending: boolean;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onVariantSwitch: (fromVariantId: string, toVariantId: string) => void;
  onRemove: (variantId: string) => void;
};

const REMOVE_CONFIRM_DELAY_MS = 3500;

export function CartItemCard({
  item,
  pending,
  onQuantityChange,
  onVariantSwitch,
  onRemove,
}: CartItemCardProps) {
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  // Auto-cancel the remove confirmation after a delay.
  React.useEffect(() => {
    if (!confirmRemove) return;
    const t = window.setTimeout(() => setConfirmRemove(false), REMOVE_CONFIRM_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [confirmRemove]);

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    onRemove(item.variantId);
  };

  const canIncrease = item.purchasable && item.quantity < item.maxQuantity;
  const canDecrease = item.quantity > 1;
  const productLink = item.product.slug ? `/products/${item.product.slug}` : null;

  const titleBlock = (
    <>
      {item.issues.includes("price_changed") && item.previousPrice != null && (
        <p className="text-xs font-medium text-amber-700">
          قیمت این کالا تغییر کرده است؛ قیمت فعلی اعمال می‌شود.
          <span className="ms-1 line-through opacity-70">
            {formatPriceToman(item.previousPrice)}
          </span>
        </p>
      )}
      {item.issues.includes("stock_exceeded") && item.quantity > 0 && (
        <p className="text-xs font-medium text-amber-700">
          {`موجودی انبار کمتر از تعداد درخواستی شماست؛ تعداد به ${toFaDigits(
            item.quantity
          )} عدد کاهش یافت.`}
        </p>
      )}
      {item.issues.includes("out_of_stock") && (
        <p className="text-xs font-medium text-destructive">
          موجودی این کالا به پایان رسیده است. برای ادامه، آن را حذف یا گزینه دیگری انتخاب کنید.
        </p>
      )}
      {item.issues.includes("variant_inactive") && (
        <p className="text-xs font-medium text-destructive">
          گزینه انتخابی شما غیرفعال شده است. لطفاً گزینه دیگری از این محصول انتخاب کنید.
        </p>
      )}
      {item.issues.includes("product_unavailable") && (
        <p className="text-xs font-medium text-destructive">
          این محصول در حال حاضر عرضه نمی‌شود. برای ادامه، آن را از سبد حذف کنید.
        </p>
      )}
      {item.issues.includes("variant_removed") && (
        <p className="text-xs font-medium text-destructive">
          این کالا از فروشگاه حذف شده است. برای ادامه، آن را از سبد حذف کنید.
        </p>
      )}
    </>
  );

  return (
    <li
      className={cn(
        "relative rounded-xl border bg-card p-4 shadow-card transition-opacity",
        pending && "opacity-60",
        !item.purchasable && "border-destructive/30"
      )}
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Image */}
        <div className="shrink-0">
          {productLink ? (
            <Link href={productLink} className="block" tabIndex={-1} aria-hidden="true">
              <ItemImage item={item} />
            </Link>
          ) : (
            <ItemImage item={item} />
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {productLink ? (
                <Link
                  href={productLink}
                  className="text-sm font-semibold leading-6 text-foreground hover:text-[var(--reyhan-blue-700)] sm:text-[15px]"
                >
                  {item.product.title}
                </Link>
              ) : (
                <span className="text-sm font-semibold leading-6 text-foreground sm:text-[15px]">
                  {item.product.title}
                </span>
              )}
              {item.variant && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  گزینه: {item.variant.title}
                  <span className="ms-2 opacity-70" dir="ltr">
                    ({item.variant.sku})
                  </span>
                </p>
              )}
            </div>

            {/* Remove */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleRemove}
                aria-label={
                  confirmRemove
                    ? `تأیید حذف «${item.product.title}» از سبد خرید`
                    : `حذف «${item.product.title}» از سبد خرید`
                }
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md border transition-colors",
                  confirmRemove
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-input bg-background text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                {confirmRemove ? (
                  <span className="text-[11px] font-bold">حذف؟</span>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                    <path
                      d="M3 4L13 12M13 4L3 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {titleBlock}

          {/* Variant switcher — only when the product offers other active variants.
              The current (possibly inactive) variant is always present as a
              disabled option so the select never shows a wrong value. */}
          {item.variantOptions.length > 1 && item.variant && (
            <div>
              <label
                htmlFor={`variant-${item.variantId}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                تغییر گزینه
              </label>
              <select
                id={`variant-${item.variantId}`}
                value={item.variantId}
                onChange={(e) => {
                  if (e.target.value !== item.variantId) {
                    onVariantSwitch(item.variantId, e.target.value);
                  }
                }}
                disabled={pending}
                className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {/* Current variant is always present first — even when it is no
                    longer purchasable, so the select never lies about the value. */}
                {!item.variantOptions.some((o) => o.variantId === item.variantId) && (
                  <option value={item.variantId}>
                    {item.variant.title} — انتخاب فعلی
                  </option>
                )}
                {item.variantOptions.map((opt) => (
                  <option
                    key={opt.variantId}
                    value={opt.variantId}
                    disabled={!opt.isCurrent && opt.availableStock <= 0}
                  >
                    {opt.title}
                    {opt.availableStock > 0
                      ? ` — ${formatPriceToman(opt.price)}`
                      : " — ناموجود"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Availability */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                item.purchasable
                  ? item.availability === "low_stock"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
              {availabilityLabel(item.availability)}
            </span>
            {item.purchasable && item.maxQuantity <= 5 && (
              <span className="text-[11px] text-amber-700">
                تنها {toFaDigits(item.maxQuantity)} عدد در انبار باقی مانده است
              </span>
            )}
          </div>

          {/* Quantity + totals */}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-3">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">تعداد</span>
              <div className="inline-flex h-10 items-center rounded-md border border-input bg-background">
                <button
                  type="button"
                  aria-label={`کاهش تعداد «${item.product.title}»`}
                  onClick={() => onQuantityChange(item.variantId, item.quantity - 1)}
                  disabled={pending || !canDecrease}
                  className="inline-flex size-10 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                >
                  −
                </button>
                <output
                  aria-live="polite"
                  className="w-10 text-center text-sm font-semibold tabular-nums text-foreground"
                >
                  {toFaDigits(item.quantity)}
                </output>
                <button
                  type="button"
                  aria-label={`افزایش تعداد «${item.product.title}»`}
                  onClick={() => onQuantityChange(item.variantId, item.quantity + 1)}
                  disabled={pending || !canIncrease}
                  className="inline-flex size-10 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-end">
              <span className="block text-xs text-muted-foreground">
                {item.quantity > 1 ? "جمع این ردیف" : "قیمت واحد"}
              </span>
              <span
                className={cn(
                  "block text-sm font-bold tabular-nums sm:text-[15px]",
                  item.purchasable ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatPriceToman(item.purchasable ? item.lineTotal : item.unitPrice)}
              </span>
              {item.quantity > 1 && item.purchasable && (
                <span className="block text-[11px] tabular-nums text-muted-foreground">
                  {formatPriceToman(item.unitPrice)} هر عدد
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function ItemImage({ item }: { item: ValidatedCartItem }) {
  return (
    <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {item.product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.product.image.url}
          alt={item.product.image.alt}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8 text-muted-foreground/50" fill="none">
          <path
            d="M7 16C7 16 9 14 10.5 12C12 10 13.5 8 15 6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M12 18C12 18 12.5 14.5 14 12C15.5 9.5 18 7 18 7"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )}
    </div>
  );
}
