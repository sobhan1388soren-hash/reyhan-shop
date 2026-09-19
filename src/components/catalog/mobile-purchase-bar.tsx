"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPriceToman } from "@/lib/catalog/format";
import { isPurchasable } from "@/lib/catalog/availability";
import type { CatalogVariant } from "@/lib/catalog/types";
import { useCart } from "@/hooks/use-cart";

// Mobile sticky purchase bar — keeps Add to Cart reachable while scrolling.
// Mirrors the default variant choice from the purchase panel and scrolls
// the user to the full purchase panel when a variant choice is needed.

type MobilePurchaseBarProps = {
  productTitle: string;
  variants: CatalogVariant[];
  defaultVariantId?: string;
};

export function MobilePurchaseBar({
  productTitle,
  variants,
  defaultVariantId,
}: MobilePurchaseBarProps) {
  const { addToCart } = useCart();
  const [visible, setVisible] = React.useState(true);

  const defaultVariant =
    variants.find((v) => v.id === defaultVariantId) ??
    variants.find((v) => v.isDefault && v.isActive) ??
    variants.find((v) => v.isActive) ??
    variants[0];

  const purchasable =
    defaultVariant != null &&
    defaultVariant.isActive &&
    isPurchasable(
      defaultVariant.inventory
        ? defaultVariant.inventory.quantity - defaultVariant.inventory.reservedQuantity > 0
          ? defaultVariant.inventory.quantity - defaultVariant.inventory.reservedQuantity <=
            defaultVariant.inventory.lowStockThreshold
            ? "low_stock"
            : "in_stock"
          : "out_of_stock"
        : "out_of_stock"
    );

  React.useEffect(() => {
    const onScroll = () => {
      const purchasePanel = document.getElementById("purchase-panel");
      if (!purchasePanel) return;
      const rect = purchasePanel.getBoundingClientRect();
      // Hide the bar while the purchase panel itself is on screen
      setVisible(rect.bottom < 120 || rect.top > 80);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAdd = () => {
    if (!defaultVariant || !purchasable) {
      document.getElementById("purchase-panel")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    addToCart(defaultVariant.id, 1, defaultVariant.price);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur transition-transform lg:hidden",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      aria-label="خرید سریع"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{productTitle}</p>
          {defaultVariant && (
            <p className="text-sm font-bold tabular-nums text-foreground">
              {formatPriceToman(defaultVariant.price)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center rounded-md px-6 text-sm font-semibold shadow-sm transition-colors",
            purchasable
              ? "bg-primary text-primary-foreground hover:bg-[var(--reyhan-blue-700)]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {variants.length > 1 ? "مشاهده گزینه‌ها و خرید" : purchasable ? "افزودن به سبد خرید" : "فعلاً قابل خرید نیست"}
        </button>
      </div>
    </div>
  );
}
