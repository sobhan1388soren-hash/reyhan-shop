import type { AvailabilityState, CatalogVariant } from "./types";

// Derive availability from product status + variants inventory
// Priority: unavailable > out_of_stock > low_stock > in_stock
export function getVariantAvailability(variant: CatalogVariant): AvailabilityState {
  if (!variant.isActive) return "unavailable";
  const inv = variant.inventory;
  if (!inv) return "out_of_stock";
  const available = inv.quantity - inv.reservedQuantity;
  if (available <= 0) return "out_of_stock";
  if (available <= inv.lowStockThreshold) return "low_stock";
  return "in_stock";
}

export function getProductAvailability(
  productStatus: string,
  variants: CatalogVariant[]
): AvailabilityState {
  if (productStatus !== "ACTIVE") return "unavailable";
  if (variants.length === 0) return "unavailable";
  const activeVariants = variants.filter((v) => v.isActive);
  if (activeVariants.length === 0) return "unavailable";

  const states = activeVariants.map(getVariantAvailability);
  if (states.includes("in_stock")) return "in_stock";
  if (states.includes("low_stock")) return "low_stock";
  return "out_of_stock";
}

export function availabilityLabel(state: AvailabilityState): string {
  switch (state) {
    case "in_stock":
      return "موجود در انبار";
    case "low_stock":
      return "موجودی محدود";
    case "out_of_stock":
      return "ناموجود";
    case "unavailable":
      return "غیرقابل عرضه";
  }
}

export function availabilityVariant(
  state: AvailabilityState
): "success" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "in_stock":
      return "success";
    case "low_stock":
      return "outline";
    case "out_of_stock":
      return "secondary";
    case "unavailable":
      return "destructive";
  }
}

export function isPurchasable(state: AvailabilityState): boolean {
  return state === "in_stock" || state === "low_stock";
}
