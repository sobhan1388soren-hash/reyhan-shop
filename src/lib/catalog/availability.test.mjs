// Unit tests — catalog availability derivation (pure logic, DB-free).
//
// Focused coverage for getProductAvailability only:
//   - non-ACTIVE product status → unavailable
//   - zero variants → unavailable
//   - only inactive variants → unavailable
//   - in-stock / low-stock / out-of-stock active variants
//   - null inventory → out_of_stock (not purchasable)
//   - mixed in-stock + low-stock variants → in_stock (per-variant priority)
//   - null-inventory sibling rescued by a separate in-stock variant
//
// Run: node --test src/lib/catalog/availability.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { getProductAvailability, isPurchasable } from "./availability.ts";

function variant(overrides = {}) {
  return {
    id: "v1",
    title: "گونه پیشفرض",
    sku: "SKU-1",
    price: 100,
    compareAtPrice: null,
    isActive: true,
    isDefault: true,
    inventory: { quantity: 10, reservedQuantity: 0, lowStockThreshold: 5 },
    ...overrides,
  };
}

// ── Unavailable states ──────────────────────────────────────────────────

test("non-ACTIVE product is unavailable regardless of variant stock", () => {
  const variants = [variant()];
  assert.equal(getProductAvailability("DRAFT", variants), "unavailable");
  assert.equal(getProductAvailability("ARCHIVED", variants), "unavailable");
});

test("product with zero variants is unavailable", () => {
  assert.equal(getProductAvailability("ACTIVE", []), "unavailable");
});

test("product whose variants are all inactive is unavailable", () => {
  const variants = [
    variant({ id: "v1", isActive: false }),
    variant({ id: "v2", isActive: false, inventory: { quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 } }),
  ];
  assert.equal(getProductAvailability("ACTIVE", variants), "unavailable");
});

// ── In stock ────────────────────────────────────────────────────────────

test("single active variant with stock above threshold is in_stock", () => {
  assert.equal(getProductAvailability("ACTIVE", [variant()]), "in_stock");
});

// ── Low stock ───────────────────────────────────────────────────────────

test("active variant at or below the low-stock threshold is low_stock", () => {
  // available = 5 == threshold 5 → low
  const atThreshold = variant({ inventory: { quantity: 5, reservedQuantity: 0, lowStockThreshold: 5 } });
  assert.equal(getProductAvailability("ACTIVE", [atThreshold]), "low_stock");
  // available = 2 (3 on hand, 1 reserved) > 0 and <= threshold 2 → low
  const reservedIntoLow = variant({
    inventory: { quantity: 3, reservedQuantity: 1, lowStockThreshold: 2 },
  });
  assert.equal(getProductAvailability("ACTIVE", [reservedIntoLow]), "low_stock");
});

// ── Out-of-stock states ─────────────────────────────────────────────────

test("reserved-equal stock is out_of_stock", () => {
  const fullyReserved = variant({
    inventory: { quantity: 3, reservedQuantity: 3, lowStockThreshold: 5 },
  });
  assert.equal(getProductAvailability("ACTIVE", [fullyReserved]), "out_of_stock");
});

test("null inventory is treated as out_of_stock, not unavailable", () => {
  const noInventory = variant({ inventory: null });
  assert.equal(getProductAvailability("ACTIVE", [noInventory]), "out_of_stock");
  // and an active variant cannot rescue a sibling with null inventory into low_stock
  const mixed = [variant({ id: "v1" }), variant({ id: "v2", inventory: null })];
  assert.equal(getProductAvailability("ACTIVE", mixed), "in_stock");
});

test("all active variants out of stock yield out_of_stock", () => {
  const variants = [
    variant({ id: "v1", inventory: { quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 } }),
    variant({ id: "v2", inventory: { quantity: 2, reservedQuantity: 2, lowStockThreshold: 5 } }),
  ];
  assert.equal(getProductAvailability("ACTIVE", variants), "out_of_stock");
});

// ── Mixed variants — per-variant priority (approved rule) ─────────────────

test("mixed in-stock and low-stock active variants → in_stock (approved rule)", () => {
  // Approved rule: if at least one active variant is purchasable and has
  // in_stock availability, the product is in_stock. A low-stock sibling does
  // not prevent an in-stock variant from determining the outcome.
  const mixed = [
    variant({ id: "v1", inventory: { quantity: 10, reservedQuantity: 0, lowStockThreshold: 5 } }),
    variant({ id: "v2", inventory: { quantity: 3, reservedQuantity: 0, lowStockThreshold: 3 } }),
  ];
  assert.equal(getProductAvailability("ACTIVE", mixed), "in_stock");
});

// ── isPurchasable — the inStock predicate ─────────────────────────────────

test("isPurchasable: in_stock and low_stock are purchasable, out_of_stock and unavailable are not", () => {
  assert.equal(isPurchasable("in_stock"), true);
  assert.equal(isPurchasable("low_stock"), true);
  assert.equal(isPurchasable("out_of_stock"), false);
  assert.equal(isPurchasable("unavailable"), false);
});

// ── inStock semantics — available = quantity - reservedQuantity > 0 ─────────
// This is equivalent to isPurchasable(p.availability), which covers:
//   in_stock  → available > lowStockThreshold → purchasable ✓
//   low_stock  → 0 < available <= lowStockThreshold → purchasable ✓
//   out_of_stock → available <= 0 → not purchasable ✓
//   unavailable → no active variants → not purchasable ✓

test("inStock: fully reserved stock (available === 0) is NOT purchasable", () => {
  // quantity = 3, reservedQuantity = 3 → available = 0 → out_of_stock
  const fullyReserved = variant({
    inventory: { quantity: 3, reservedQuantity: 3, lowStockThreshold: 5 },
  });
  const avail = getProductAvailability("ACTIVE", [fullyReserved]);
  assert.equal(avail, "out_of_stock");
  assert.equal(isPurchasable(avail), false, "fully reserved → not purchasable for inStock");
});

test("inStock: available low stock (0 < available <= threshold) IS purchasable", () => {
  // quantity = 5, reservedQuantity = 0, threshold = 5 → available = 5, at threshold → low_stock
  const atThreshold = variant({ inventory: { quantity: 5, reservedQuantity: 0, lowStockThreshold: 5 } });
  const avail = getProductAvailability("ACTIVE", [atThreshold]);
  assert.equal(avail, "low_stock");
  assert.equal(isPurchasable(avail), true, "low_stock → purchasable for inStock");

  // quantity = 3, reservedQuantity = 0, threshold = 3 → available = 3, at threshold → low_stock
  const reservedIntoLow = variant({
    inventory: { quantity: 3, reservedQuantity: 0, lowStockThreshold: 3 },
  });
  const avail2 = getProductAvailability("ACTIVE", [reservedIntoLow]);
  assert.equal(avail2, "low_stock");
  assert.equal(isPurchasable(avail2), true, "at-threshold low_stock → purchasable for inStock");
});

test("inStock: inactive variants do not make a product purchasable", () => {
  // Only variant is inactive → unavailable → not purchasable
  const inactive = variant({ isActive: false, inventory: { quantity: 100, reservedQuantity: 0, lowStockThreshold: 5 } });
  const avail = getProductAvailability("ACTIVE", [inactive]);
  assert.equal(avail, "unavailable");
  assert.equal(isPurchasable(avail), false, "inactive variant → not purchasable for inStock");

  // Mix of inactive (high stock) and active (out of stock) → out_of_stock → not purchasable
  const mixed = [
    variant({ id: "v1", isActive: false, inventory: { quantity: 100, reservedQuantity: 0, lowStockThreshold: 5 } }),
    variant({ id: "v2", isActive: true, inventory: { quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 } }),
  ];
  const avail2 = getProductAvailability("ACTIVE", mixed);
  assert.equal(avail2, "out_of_stock");
  assert.equal(isPurchasable(avail2), false, "only inactive variant with stock doesn't rescue");
});
