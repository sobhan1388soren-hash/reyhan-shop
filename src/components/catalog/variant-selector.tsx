"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { getVariantAvailability, availabilityLabel } from "@/lib/catalog/availability";
import type { CatalogVariant } from "@/lib/catalog/types";

type VariantSelectorProps = {
  variants: CatalogVariant[];
  defaultVariantId?: string;
  selectedVariantId?: string;
  onSelect?: (variant: CatalogVariant) => void;
  showAvailability?: boolean;
};

export function VariantSelector({
  variants,
  defaultVariantId,
  selectedVariantId: controlledId,
  onSelect,
  showAvailability = true,
}: VariantSelectorProps) {
  const initialId = controlledId ?? defaultVariantId ?? variants.find((v) => v.isDefault)?.id ?? variants[0]?.id;
  const [internalId, setInternalId] = React.useState<string | undefined>(initialId);

  const selectedId = controlledId ?? internalId ?? variants.find((v) => v.isDefault)?.id ?? variants[0]?.id;
  const selectedVariant = variants.find((v) => v.id === selectedId);

  const handleSelect = React.useCallback(
    (variant: CatalogVariant) => {
      if (!variant.isActive) return;
      if (controlledId === undefined) {
        setInternalId(variant.id);
      }
      onSelect?.(variant);
    },
    [controlledId, onSelect]
  );

  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">گزینه‌ای برای این محصول ثبت نشده است.</p>
    );
  }

  return (
    <div className="rounded-lg border border-muted/50 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        انتخاب گزینه
      </h3>
      <div className="max-h-64 space-y-2 overflow-y-auto" role="radiogroup" aria-label="انتخاب مدل محصول">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId;
          const availability = getVariantAvailability(variant);
          const purchasable = variant.isActive && availability !== "out_of_stock" && availability !== "unavailable";
          const price = formatPriceToman(variant.price);

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!variant.isActive}
              onClick={() => handleSelect(variant)}
              className={cn(
                "flex w-full flex-col items-start justify-between rounded-md border px-3 py-2 text-xs font-medium",
                isSelected
                  ? "border-primary bg-primary/5"
                  : variant.isActive
                    ? "border-input bg-background hover:bg-accent"
                    : "border-muted/50 opacity-50",
                !variant.isActive && "cursor-not-allowed"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{variant.title}</span>
                <span className="shrink-0 font-medium tabular-nums">{price}</span>
              </div>
              {showAvailability && (
                <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-1.5 rounded-full",
                      purchasable ? "bg-green-500" : "bg-muted-foreground/40"
                    )}
                  />
                  {availabilityLabel(availability)}
                  {variant.inventory && purchasable
                    ? ` — ${toFaDigits(variant.inventory.quantity - variant.inventory.reservedQuantity)} عدد موجود`
                    : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selectedVariant && (
        <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
          انتخاب شما: {selectedVariant.title} — {formatPriceToman(selectedVariant.price)}
        </p>
      )}
    </div>
  );
}

// Backward-compatible alias (previous pages imported VariantSelect)
export const VariantSelect = VariantSelector;
