"use server";

// Cart server actions — server-side validation of the guest cart.
// The client sends its persisted entries; the server re-derives every
// price, stock, and total from the database. Client prices are never used.

import { validateCart } from "@/lib/cart/validate";
import type { CartValidationResult } from "@/lib/cart/types";

export type CartActionOutcome =
  | { ok: true; cart: CartValidationResult }
  | { ok: false; error: string };

/**
 * Validate the guest cart against current catalog state.
 * Input is arbitrary client data and is fully sanitized before touching the DB.
 */
export async function validateCartAction(
  entries: unknown
): Promise<CartActionOutcome> {
  try {
    const cart = await validateCart(entries);
    return { ok: true, cart };
  } catch {
    return {
      ok: false,
      error:
        "در حال حاضر امکان بررسی سبد خرید وجود ندارد. لطفاً دوباره تلاش کنید.",
    };
  }
}
