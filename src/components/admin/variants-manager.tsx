"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  updateInventoryThresholdAction,
  type ProductActionState,
} from "@/app/actions/products";
import type { AdminVariantDetail } from "@/lib/admin/product-service";
import { Input } from "@/components/ui/input";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import {
  VariantForm,
  InventoryForm,
  DeleteVariantButton,
  emptyVariantDraft,
  draftFromVariant,
} from "@/components/admin/variant-form";
import { cn } from "@/lib/utils";

// VariantsManager — variant CRUD + per-variant pricing, inventory and
// low-stock threshold. Prices live on variants in this schema; the storefront
// derives availability from variant inventory.

function ThresholdForm({ productId, variant }: { productId: string; variant: AdminVariantDetail }) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    updateInventoryThresholdAction,
    {}
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant.id} />
      <div className="w-32">
        <label
          htmlFor={`thr-${variant.id}`}
          className="mb-1 block text-[11px] font-medium text-muted-foreground"
        >
          آستانه موجودی کم
        </label>
        <Input
          id={`thr-${variant.id}`}
          name="lowStockThreshold"
          dir="ltr"
          className="h-8 text-center text-xs"
          inputMode="numeric"
          defaultValue={String(variant.inventory?.lowStockThreshold ?? 5)}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        {pending ? "..." : "ذخیره"}
      </button>
      {state.error && <span className="text-[11px] text-destructive">{state.error}</span>}
      {state.message && <span className="text-[11px] text-[var(--reyhan-green-700)]">{state.message}</span>}
    </form>
  );
}

export function VariantsManager({
  productId,
  variants,
  canViewCost,
}: {
  productId: string;
  variants: AdminVariantDetail[];
  canViewCost: boolean;
}) {
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [inventoryId, setInventoryId] = React.useState<string | null>(null);

  return (
    <div className="space-y-5">
      {variants.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          این محصول هنوز گونه‌ای ندارد. برای فروش، حداقل یک گونه با قیمت و موجودی بسازید.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="گونه‌های محصول">
          {variants.map((variant) => {
            const available = Math.max(
              0,
              (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0)
            );
            return (
              <li key={variant.id} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{variant.title}</p>
                      {variant.isDefault && <AdminStatusBadge tone="info">پیش‌فرض</AdminStatusBadge>}
                      <AdminStatusBadge tone={variant.isActive ? "success" : "neutral"}>
                        {variant.isActive ? "فعال" : "غیرفعال"}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground" dir="ltr">
                      SKU: {variant.sku}
                      {variant.barcode ? ` · بارکد: ${variant.barcode}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      قیمت: <strong className="font-semibold text-foreground">{formatPriceToman(variant.price)}</strong>
                      {variant.compareAtPrice != null && (
                        <>
                          {" · خط‌خورده: "}
                          {formatPriceToman(variant.compareAtPrice)}
                        </>
                      )}
                      {canViewCost && variant.costPrice != null && (
                        <> · تمام‌شده: {formatPriceToman(variant.costPrice)}</>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      موجودی: {toFaDigits(variant.inventory?.quantity ?? 0)} · رزرو:{" "}
                      {toFaDigits(variant.inventory?.reservedQuantity ?? 0)} · قابل فروش:{" "}
                      <span className={cn(available <= 0 && "text-destructive")}>{toFaDigits(available)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInventoryId((id) => (id === variant.id ? null : variant.id));
                        setEditingId(null);
                      }}
                      className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      موجودی
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId((id) => (id === variant.id ? null : variant.id));
                        setInventoryId(null);
                      }}
                      className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      ویرایش
                    </button>
                    <DeleteVariantButton productId={productId} variant={variant} />
                  </div>
                </div>

                {editingId === variant.id && (
                  <div className="mt-4 border-t pt-4">
                    <VariantForm
                      productId={productId}
                      draft={draftFromVariant(variant)}
                      canViewCost={canViewCost}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}

                {inventoryId === variant.id && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <InventoryForm
                      productId={productId}
                      variant={variant}
                      onDone={() => setInventoryId(null)}
                    />
                    <ThresholdForm productId={productId} variant={variant} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-4 text-sm font-semibold text-foreground">گونه جدید</p>
          <VariantForm
            productId={productId}
            draft={emptyVariantDraft}
            canViewCost={canViewCost}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          افزودن گونه
        </button>
      )}
    </div>
  );
}