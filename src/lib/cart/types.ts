// Cart domain types — shared between client storage and server validation.
// Prices are always in Rial (1 Toman = 10 Rial), matching the catalog schema.

import type { AvailabilityState } from "@/lib/catalog/types";

/** Entry persisted in the guest cart (localStorage). Never trusted server-side. */
export type StoredCartEntry = {
  variantId: string;
  quantity: number;
  /** Rial price the user saw when adding — UX-only; totals always come from the server. */
  priceSnapshot?: number | null;
  /** Epoch milliseconds when the entry was added. */
  addedAt?: number;
};

export type CartItemIssue =
  | "price_changed"
  | "stock_exceeded"
  | "out_of_stock"
  | "variant_inactive"
  | "variant_removed"
  | "product_unavailable"
  | "product_removed";

export type CartVariantOption = {
  variantId: string;
  title: string;
  sku: string;
  price: number; // current server price, Rial
  availableStock: number;
  availability: AvailabilityState;
  isActive: boolean;
  isCurrent: boolean;
};

export type ValidatedCartItem = {
  variantId: string;
  storedQuantity: number;
  /** Effective, server-corrected quantity (0 when not purchasable). */
  quantity: number;
  /** Stock ceiling for the quantity control (0 when not purchasable). */
  maxQuantity: number;
  /** Authoritative current unit price in Rial. */
  unitPrice: number;
  /** unitPrice × quantity — 0 when not purchasable. */
  lineTotal: number;
  availability: AvailabilityState;
  purchasable: boolean;
  issues: CartItemIssue[];
  /** Price from the client snapshot — display-only, never used in totals. */
  previousPrice: number | null;
  product: {
    id: string;
    title: string;
    slug: string;
    status: string;
    image: { url: string; alt: string } | null;
  };
  variant: {
    id: string;
    title: string;
    sku: string;
  } | null;
  variantOptions: CartVariantOption[];
};

export type CartValidationResult = {
  items: ValidatedCartItem[];
  /** Server-calculated subtotal in Rial — only purchasable items count. */
  subtotal: number;
  totalCount: number;
  purchasableCount: number;
  allPurchasable: boolean;
  hasIssues: boolean;
};

export function emptyCartResult(): CartValidationResult {
  return {
    items: [],
    subtotal: 0,
    totalCount: 0,
    purchasableCount: 0,
    allPurchasable: true,
    hasIssues: false,
  };
}
