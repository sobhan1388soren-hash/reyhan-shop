// Server-side cart validation — the authoritative source for prices,
// stock, availability, and totals. The client's stored quantities act only
// as *wishes*; everything of value is re-derived from the database here.

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getVariantAvailability } from "@/lib/catalog/availability";
import type { AvailabilityState, CatalogVariant } from "@/lib/catalog/types";
import { sanitizeEntries } from "./storage";
import type {
  CartValidationResult,
  CartVariantOption,
  StoredCartEntry,
  ValidatedCartItem,
} from "./types";
import { emptyCartResult } from "./types";

const MAX_ITEMS = 50;

type VariantRow = Prisma.ProductVariantGetPayload<{ include: { inventory: true } }>;

type ProductRow = Prisma.ProductGetPayload<{
  include: {
    images: true;
    variants: { include: { inventory: true } };
  };
}>;

function variantToCatalogVariant(v: VariantRow): CatalogVariant {
  return {
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    isActive: v.isActive,
    isDefault: v.isDefault,
    inventory: v.inventory
      ? {
          quantity: v.inventory.quantity,
          reservedQuantity: v.inventory.reservedQuantity,
          lowStockThreshold: v.inventory.lowStockThreshold,
        }
      : null,
  };
}

function availableStock(v: VariantRow): number {
  if (!v.inventory) return 0;
  return Math.max(0, v.inventory.quantity - v.inventory.reservedQuantity);
}

function isVariantPurchasable(state: AvailabilityState, stock: number): boolean {
  return state !== "out_of_stock" && state !== "unavailable" && stock > 0;
}

/**
 * Validate a guest cart payload against current database state.
 * Never trusts client prices — quantity is treated only as the desired
 * amount and is clamped to current stock; totals use authoritative prices.
 */
export async function validateCart(rawEntries: unknown): Promise<CartValidationResult> {
  const entries = sanitizeEntries(rawEntries).slice(0, MAX_ITEMS);
  if (entries.length === 0) return emptyCartResult();

  try {
    const variantIds = entries.map((e) => e.variantId);
    const products = await prisma.product.findMany({
      where: { variants: { some: { id: { in: variantIds } } } },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { include: { inventory: true } },
      },
    });

    // variantId -> owning product; missing ids mean the variant/product was removed.
    const variantIndex = new Map<string, ProductRow>();
    for (const p of products) {
      for (const v of p.variants) variantIndex.set(v.id, p);
    }

    const items: ValidatedCartItem[] = [];
    let subtotal = 0;
    let purchasableCount = 0;
    let allPurchasable = true;

    for (const entry of entries) {
      const product = variantIndex.get(entry.variantId);

      if (!product) {
        items.push(removedItem(entry, "variant_removed"));
        allPurchasable = false;
        continue;
      }

      const variant = product.variants.find((v) => v.id === entry.variantId);
      if (!variant) {
        items.push(removedItem(entry, "variant_removed"));
        allPurchasable = false;
        continue;
      }

      if (product.status !== "ACTIVE") {
        items.push(
          unavailableProductItem(product, entry, variant, ["product_unavailable"])
        );
        allPurchasable = false;
        continue;
      }

      const stock = availableStock(variant);
      const variantState = getVariantAvailability(variantToCatalogVariant(variant));

      if (!variant.isActive || !isVariantPurchasable(variantState, stock)) {
        items.push(
          unavailableProductItem(product, entry, variant, [
            variant.isActive ? "out_of_stock" : "variant_inactive",
          ])
        );
        allPurchasable = false;
        continue;
      }

      // Purchasable — clamp desired quantity to current stock.
      const issues: ValidatedCartItem["issues"] = [];
      let quantity = entry.quantity;
      if (quantity > stock) {
        issues.push("stock_exceeded");
        quantity = stock;
      }
      const previousPrice =
        typeof entry.priceSnapshot === "number" && entry.priceSnapshot !== variant.price
          ? entry.priceSnapshot
          : null;
      if (previousPrice !== null) issues.push("price_changed");

      const lineTotal = variant.price * quantity;

      items.push({
        variantId: variant.id,
        storedQuantity: entry.quantity,
        quantity,
        maxQuantity: stock,
        unitPrice: variant.price,
        lineTotal,
        availability: variantState,
        purchasable: true,
        issues,
        previousPrice,
        product: toProductInfo(product),
        variant: { id: variant.id, title: variant.title, sku: variant.sku },
        variantOptions: toVariantOptions(product, variant.id),
      });
      subtotal += lineTotal;
      purchasableCount += 1;
    }

    return {
      items,
      subtotal,
      totalCount: items.length,
      purchasableCount,
      allPurchasable,
      hasIssues: items.some((i) => i.issues.length > 0),
    };
  } catch {
    // DB unreachable — signal the UI to render the error state, never fake data.
    throw new Error("CART_VALIDATION_UNAVAILABLE");
  }
}

function toProductInfo(product: ProductRow): ValidatedCartItem["product"] {
  const img = product.images[0];
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    status: product.status,
    image: img ? { url: img.url, alt: img.alt ?? product.title } : null,
  };
}

function toVariantOptions(product: ProductRow, currentVariantId: string): CartVariantOption[] {
  // Only active variants of an ACTIVE product are offered — never invent variants.
  if (product.status !== "ACTIVE") return [];
  return product.variants
    .filter((v) => v.isActive)
    .map((v) => {
      const catalogVariant = variantToCatalogVariant(v);
      return {
        variantId: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price,
        availableStock: availableStock(v),
        availability: getVariantAvailability(catalogVariant),
        isActive: v.isActive,
        isCurrent: v.id === currentVariantId,
      };
    });
}

function unavailableProductItem(
  product: ProductRow,
  entry: StoredCartEntry,
  variant: VariantRow,
  issues: ValidatedCartItem["issues"]
): ValidatedCartItem {
  return {
    variantId: entry.variantId,
    storedQuantity: entry.quantity,
    quantity: 0,
    maxQuantity: 0,
    unitPrice: variant.price,
    lineTotal: 0,
    availability: getVariantAvailability(variantToCatalogVariant(variant)),
    purchasable: false,
    issues,
    previousPrice:
      typeof entry.priceSnapshot === "number" && entry.priceSnapshot !== variant.price
        ? entry.priceSnapshot
        : null,
    product: toProductInfo(product),
    variant: { id: variant.id, title: variant.title, sku: variant.sku },
    variantOptions: toVariantOptions(product, entry.variantId),
  };
}

function removedItem(
  entry: StoredCartEntry,
  issue: ValidatedCartItem["issues"][number]
): ValidatedCartItem {
  return {
    variantId: entry.variantId,
    storedQuantity: entry.quantity,
    quantity: 0,
    maxQuantity: 0,
    unitPrice: 0,
    lineTotal: 0,
    availability: "unavailable",
    purchasable: false,
    issues: [issue],
    previousPrice: typeof entry.priceSnapshot === "number" ? entry.priceSnapshot : null,
    product: {
      id: "",
      title: "محصول حذف‌شده",
      slug: "",
      status: "REMOVED",
      image: null,
    },
    variant: null,
    variantOptions: [],
  };
}
