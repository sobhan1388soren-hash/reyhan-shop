"use client";

// Guest cart hook — Phase 8 extension of the Phase 6 minimal cart.
// Persists {variantId, quantity, priceSnapshot} in localStorage under the
// same legacy key family. All prices here are UX snapshots only; the cart
// page revalidates everything server-side and computes authoritative totals.

import * as React from "react";
import {
  readStoredEntries,
  writeStoredEntries,
  isValidMutation,
  getStoredEntriesSnapshot,
  CART_CHANGE_EVENT,
} from "@/lib/cart/storage";
import type { StoredCartEntry } from "@/lib/cart/types";

const emptyCart: StoredCartEntry[] = [];

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener(CART_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CART_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

const getSnapshot = (): StoredCartEntry[] => getStoredEntriesSnapshot();

export function useCart() {
  const entries = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => emptyCart
  );

  /** Add `quantity` of a variant; merges with an existing entry. */
  const addToCart = React.useCallback(
    (variantId: string, quantity: number, priceSnapshot?: number): boolean => {
      if (!isValidMutation(variantId, quantity)) return false;
      const current = readStoredEntries();
      const existing = current.find((e) => e.variantId === variantId);
      const snapshot =
        typeof priceSnapshot === "number" && Number.isFinite(priceSnapshot)
          ? priceSnapshot
          : existing?.priceSnapshot;
      const next: StoredCartEntry[] = existing
        ? current.map((e) =>
            e.variantId === variantId
              ? { ...e, quantity: e.quantity + quantity, priceSnapshot: snapshot }
              : e
          )
        : [
            ...current,
            {
              variantId,
              quantity,
              ...(snapshot != null
                ? { priceSnapshot: snapshot, addedAt: Date.now() }
                : { addedAt: Date.now() }),
            },
          ];
      return writeStoredEntries(next);
    },
    []
  );

  /** Set an exact quantity (clamped 1..stock by the caller/server). */
  const updateQuantity = React.useCallback(
    (variantId: string, quantity: number): boolean => {
      if (!isValidMutation(variantId, quantity)) return false;
      const current = readStoredEntries();
      const next = current.map((e) =>
        e.variantId === variantId ? { ...e, quantity } : e
      );
      return writeStoredEntries(next);
    },
    []
  );

  /** Replace one variant with another (variant change inside the cart). */
  const switchVariant = React.useCallback(
    (fromVariantId: string, toVariantId: string): boolean => {
      if (fromVariantId === toVariantId) return true;
      if (!isValidMutation(toVariantId, 1)) return false;
      const current = readStoredEntries();
      const from = current.find((e) => e.variantId === fromVariantId);
      const to = current.find((e) => e.variantId === toVariantId);
      if (!from) return false;

      let next: StoredCartEntry[];
      if (to) {
        // Merge: move quantity onto the target, drop the source.
        next = current
          .filter((e) => e.variantId !== fromVariantId)
          .map((e) =>
            e.variantId === toVariantId
              ? { ...e, quantity: e.quantity + from.quantity }
              : e
          );
      } else {
        next = current.map((e) =>
          e.variantId === fromVariantId ? { ...e, variantId: toVariantId } : e
        );
      }
      return writeStoredEntries(next);
    },
    []
  );

  /** Remove a single entry. */
  const removeFromCart = React.useCallback((variantId: string): boolean => {
    const current = readStoredEntries();
    const next = current.filter((e) => e.variantId !== variantId);
    if (next.length === current.length) return true; // already absent
    return writeStoredEntries(next);
  }, []);

  /** Empty the whole cart. */
  const clearCart = React.useCallback((): boolean => {
    return writeStoredEntries([]);
  }, []);

  const count = entries.reduce((sum, e) => sum + e.quantity, 0);

  return {
    entries,
    count,
    addToCart,
    updateQuantity,
    switchVariant,
    removeFromCart,
    clearCart,
  };
}
