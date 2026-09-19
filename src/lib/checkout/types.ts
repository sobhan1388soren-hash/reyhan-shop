// Checkout domain types — shared between server validation and client UI.
// All monetary values are in Rial (Int), matching the catalog schema.
// Client-submitted values of this module are NEVER trusted: every price,
// total, stock, and ownership fact is re-derived server-side from the DB.

import type { CartValidationResult } from "@/lib/cart/types";

/** Shipping method descriptor — provider-agnostic until a courier is approved. */
export type ShippingMethodOption = {
  id: string;
  title: string;
  description: string;
  /** Cost in Rial. `null` = not yet determined (provider not integrated). */
  cost: number | null;
  /** Whether this method can be selected in the current phase. */
  selectable: boolean;
};

/** Payment method descriptor — provider-agnostic until a gateway is approved. */
export type PaymentMethodOption = {
  id: "ONLINE";
  title: string;
  description: string;
  selectable: boolean;
};

export type CheckoutDiscountState = {
  /** Normalized code string the user submitted. */
  code: string;
  /** Server-computed discount amount in Rial (0 when not applied). */
  amount: number;
  applied: boolean;
  message: string | null;
  /** True when the applied discount waives the shipping cost. */
  freeShipping: boolean;
};

/** Server-validated discount attached to a checkout (Phase 12). */
export type AppliedCheckoutDiscount = {
  discountId: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  /** Raw rule value: percent (1-100) or Rial amount (0 for FREE_SHIPPING). */
  value: number;
  /** Server-computed discount amount in Rial. */
  amount: number;
  freeShipping: boolean;
};

export type CheckoutTotals = {
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
};

export type CheckoutValidation = {
  cart: CartValidationResult;
  /** True when the cart cannot proceed to order creation. */
  blocked: boolean;
};

export type CheckoutAddress = {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string | null;
  addressLine: string;
  isDefault: boolean;
};

/** Server-authoritative snapshot used by the checkout summary UI. */
export type CheckoutSnapshot = {
  cart: CartValidationResult;
  addresses: CheckoutAddress[];
  shippingMethods: ShippingMethodOption[];
  paymentMethods: PaymentMethodOption[];
  discount: CheckoutDiscountState;
  totals: CheckoutTotals;
  defaultAddressId: string | null;
};

export type CheckoutFormState = {
  status: "idle" | "success";
  error?: string;
  /** Field-level errors keyed by logical field name. */
  fieldErrors?: Record<string, string>;
  /** When set, the client must return to the cart to resolve item issues. */
  redirectToCart?: boolean;
  /** Created order id — client redirects to its success page. */
  orderId?: string;
  orderNumber?: string;
};
