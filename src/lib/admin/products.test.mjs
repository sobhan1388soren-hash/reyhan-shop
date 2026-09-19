// Unit tests — Phase 14 Part 1 product admin domain (pure logic, DB-free).
// Covers product/variant/specification/media validation and normalization,
// Toman→Rial pricing, price-history derivation, inventory adjustment policy,
// publish/delete guards, the ADMIN-only cost-price capability, and the
// Persian error-copy completeness.
//
// Run: npm run test:products   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateProductInput,
  validateVariantInput,
  validateSpecificationInput,
  validateMediaInput,
  validateInventoryInput,
  parseTomanToRial,
  parseOptionalTomanToRial,
  normalizeProductSlug,
  normalizeCategoryIds,
  derivePricePoint,
  hasDuplicateSpecKey,
  nextMediaSortOrder,
  moveMediaToFront,
  canAddMedia,
  applyInventoryChange,
  evaluateProductDeletion,
  evaluateVariantDeletion,
  evaluateProductPublish,
  canViewCostPrice,
  PRODUCT_ERROR_MESSAGES,
  MAX_PRICE_TOMAN,
  MEDIA_MAX_PER_PRODUCT,
} from "./product-rules.ts";
import { isAdminCapableRole } from "./rules.ts";

// ── Product core ────────────────────────────────────────────────────────

const validProduct = {
  title: "دستگاه تصفیه آب",
  slug: "دستگاه-تصفیه-آب",
  status: "DRAFT",
  isFeatured: "false",
  shortDescription: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  categoryIds: [],
};

test("product: valid input normalizes with defaults and derives the slug", () => {
  const result = validateProductInput({ ...validProduct, slug: "", title: "Water Filter Pro" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.slug, "water-filter-pro");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.isFeatured, false);
    assert.equal(result.data.shortDescription, null);
    assert.deepEqual(result.data.categoryIds, []);
  }
});

test("product: empty title rejected with a field error", () => {
  const result = validateProductInput({ ...validProduct, title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.title);
});

test("product: forged status rejected; real statuses accepted", () => {
  assert.equal(validateProductInput({ ...validProduct, status: "PUBLISHED" }).ok, false);
  for (const status of ["DRAFT", "ACTIVE", "ARCHIVED"]) {
    assert.equal(validateProductInput({ ...validProduct, status }).ok, true, status);
  }
});

test("product: explicit junk slug rejected", () => {
  const result = validateProductInput({ ...validProduct, slug: "!!!---!!!" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.slug);
});

test("product: isFeatured is parsed from checkbox-like values", () => {
  for (const raw of ["true", "on", "1"]) {
    const result = validateProductInput({ ...validProduct, isFeatured: raw });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.isFeatured, true, raw);
  }
});

test("product: category ids are deduped and capped (array or comma string)", () => {
  const fromArray = normalizeCategoryIds(["a", "a", " b ", "", "c"]);
  assert.deepEqual(fromArray, ["a", "b", "c"]);
  const fromString = normalizeCategoryIds("a,b , c,a");
  assert.deepEqual(fromString, ["a", "b", "c"]);
  const capped = normalizeCategoryIds(Array.from({ length: 40 }, (_, i) => `c${i}`));
  assert.equal(capped.length, 20);
});

test("product: SEO length caps are enforced", () => {
  assert.equal(validateProductInput({ ...validProduct, seoTitle: "x".repeat(121) }).ok, false);
  assert.equal(
    validateProductInput({ ...validProduct, seoDescription: "x".repeat(301) }).ok,
    false
  );
  assert.equal(validateProductInput({ ...validProduct, seoKeywords: "x".repeat(501) }).ok, false);
});

test("normalizeProductSlug mirrors the catalog convention (Persian safe)", () => {
  assert.equal(normalizeProductSlug("  Water  Filter!!  "), "water-filter");
  assert.equal(normalizeProductSlug("فیلتر رسوبی"), "فیلتر-رسوبی");
  assert.equal(normalizeProductSlug("--a--b--"), "a-b");
});

// ── Pricing ─────────────────────────────────────────────────────────────

test("parseTomanToRial: converts Toman to Rial incl. Persian digits", () => {
  assert.equal(parseTomanToRial("150000"), 1_500_000);
  assert.equal(parseTomanToRial("۱۲۳۴"), 12_340);
  assert.equal(parseTomanToRial("  200 "), 2_000);
});

test("parseTomanToRial: rejects empty, negative, junk, and over-cap", () => {
  assert.equal(parseTomanToRial(""), null);
  assert.equal(parseTomanToRial("-5"), null);
  assert.equal(parseTomanToRial("abc"), null);
  assert.equal(parseTomanToRial("1.5"), null);
  assert.equal(parseTomanToRial(String(MAX_PRICE_TOMAN + 1)), null);
  assert.equal(parseTomanToRial(String(MAX_PRICE_TOMAN)), MAX_PRICE_TOMAN * 10);
});

test("parseOptionalTomanToRial: empty → null, invalid → undefined", () => {
  assert.equal(parseOptionalTomanToRial(""), null);
  assert.equal(parseOptionalTomanToRial("۱۰۰"), 1_000);
  assert.equal(parseOptionalTomanToRial("-1"), undefined);
});

// ── Variant ─────────────────────────────────────────────────────────────

const validVariant = {
  title: "۵۰۰ لیتر — سبز",
  sku: "WF-500-GR",
  barcode: "",
  price: "150000",
  compareAtPrice: "",
  costPrice: "",
  weight: "",
  isDefault: "",
  isActive: "true",
  sortOrder: "0",
};

test("variant: valid input normalizes; price stored in Rial", () => {
  const result = validateVariantInput(validVariant);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.price, 1_500_000);
    assert.equal(result.data.compareAtPrice, null);
    assert.equal(result.data.barcode, null);
    assert.equal(result.data.isActive, true);
  }
});

test("variant: isActive defaults to true when omitted", () => {
  const rest = { ...validVariant };
  delete rest.isActive;
  const result = validateVariantInput(rest);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.isActive, true);
});

test("variant: SKU is required and shape-checked", () => {
  assert.equal(validateVariantInput({ ...validVariant, sku: "" }).ok, false);
  assert.equal(validateVariantInput({ ...validVariant, sku: "has space" }).ok, false);
  assert.equal(validateVariantInput({ ...validVariant, sku: "WF-500_GR:1" }).ok, true);
});

test("variant: barcode is optional but digit/length-checked when present", () => {
  assert.equal(validateVariantInput({ ...validVariant, barcode: "6260123456789" }).ok, true);
  assert.equal(validateVariantInput({ ...validVariant, barcode: "123" }).ok, false);
  assert.equal(validateVariantInput({ ...validVariant, barcode: "abc" }).ok, false);
});

test("variant: price is required; compare-at only shape-checked (no ordering rule)", () => {
  assert.equal(validateVariantInput({ ...validVariant, price: "" }).ok, false);
  assert.equal(validateVariantInput({ ...validVariant, price: "abc" }).ok, false);
  // compare-at below price is allowed by validation (storefront just hides it)
  const result = validateVariantInput({ ...validVariant, compareAtPrice: "100000" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.compareAtPrice, 1_000_000);
  assert.equal(validateVariantInput({ ...validVariant, compareAtPrice: "-1" }).ok, false);
});

test("variant: weight and sortOrder are bounded integers", () => {
  assert.equal(validateVariantInput({ ...validVariant, weight: "1250" }).ok, true);
  assert.equal(validateVariantInput({ ...validVariant, weight: "-1" }).ok, false);
  assert.equal(validateVariantInput({ ...validVariant, sortOrder: "12" }).ok, true);
  assert.equal(validateVariantInput({ ...validVariant, sortOrder: "99999" }).ok, false);
});

// ── Price history ───────────────────────────────────────────────────────

test("derivePricePoint: no history row when nothing relevant changed", () => {
  assert.equal(
    derivePricePoint({ price: 100, compareAtPrice: null }, { price: 100, compareAtPrice: null }),
    null
  );
});

test("derivePricePoint: emits a point only when price or compare-at changes", () => {
  assert.deepEqual(
    derivePricePoint({ price: 100, compareAtPrice: null }, { price: 120, compareAtPrice: null }),
    { price: 120, compareAtPrice: null }
  );
  assert.deepEqual(
    derivePricePoint({ price: 100, compareAtPrice: null }, { price: 100, compareAtPrice: 150 }),
    { price: 100, compareAtPrice: 150 }
  );
});

// ── Specifications ──────────────────────────────────────────────────────

test("specification: key and value required with length caps", () => {
  assert.equal(validateSpecificationInput({ key: "ظرفیت", value: "۵۰۰ لیتر" }).ok, true);
  assert.equal(validateSpecificationInput({ key: "", value: "x" }).ok, false);
  assert.equal(validateSpecificationInput({ key: "k", value: "" }).ok, false);
  assert.equal(validateSpecificationInput({ key: "k".repeat(121), value: "v" }).ok, false);
});

test("hasDuplicateSpecKey: case/whitespace-insensitive, honours excludeKey", () => {
  const keys = ["Capacity", "Warranty"];
  assert.equal(hasDuplicateSpecKey(keys, "capacity"), true);
  assert.equal(hasDuplicateSpecKey(keys, "  CAPACITY "), true);
  assert.equal(hasDuplicateSpecKey(keys, "Material"), false);
  assert.equal(hasDuplicateSpecKey(keys, "Capacity", "Capacity"), false);
});

// ── Media ───────────────────────────────────────────────────────────────

test("media: accepts http(s) and root-relative URLs; rejects other schemes", () => {
  assert.equal(validateMediaInput({ url: "https://cdn.example/x.jpg" }).ok, true);
  assert.equal(validateMediaInput({ url: "/uploads/x.jpg" }).ok, true);
  for (const url of ["javascript:alert(1)", "ftp://x/y", "//host/x.jpg", "x.jpg"]) {
    assert.equal(validateMediaInput({ url }).ok, false, url);
  }
  assert.equal(validateMediaInput({ url: "" }).ok, false);
});

test("media: ordering helpers keep the first image as primary", () => {
  const items = [
    { id: "a", sortOrder: 2 },
    { id: "b", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
  ];
  assert.equal(nextMediaSortOrder(items), 3);
  assert.equal(nextMediaSortOrder([]), 0);
  assert.deepEqual(moveMediaToFront(items, "a"), [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ]);
  // Already-primary / unknown id → stable renumber
  assert.deepEqual(moveMediaToFront(items, "b"), [
    { id: "b", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
    { id: "a", sortOrder: 2 },
  ]);
});

test("media: product media cap is enforced", () => {
  assert.equal(canAddMedia(0), true);
  assert.equal(canAddMedia(MEDIA_MAX_PER_PRODUCT - 1), true);
  assert.equal(canAddMedia(MEDIA_MAX_PER_PRODUCT), false);
});

// ── Inventory ───────────────────────────────────────────────────────────

test("inventory: restock requires a positive amount; reason optional", () => {
  const ok = validateInventoryInput({ mode: "RESTOCK", amount: "10", reason: "" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.delta, 10);
    assert.equal(ok.data.reason, "RESTOCK");
  }
  assert.equal(validateInventoryInput({ mode: "RESTOCK", amount: "0" }).ok, false);
  assert.equal(validateInventoryInput({ mode: "RESTOCK", amount: "-2" }).ok, false);
});

test("inventory: adjustment accepts signed deltas and requires a reason", () => {
  const ok = validateInventoryInput({ mode: "ADJUSTMENT", amount: "-3", reason: "شمارش انبار" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.delta, -3);
  assert.equal(validateInventoryInput({ mode: "ADJUSTMENT", amount: "0", reason: "x" }).ok, false);
  const noReason = validateInventoryInput({ mode: "ADJUSTMENT", amount: "-3", reason: "" });
  assert.equal(noReason.ok, false);
  if (!noReason.ok) assert.ok(noReason.errors.reason);
});

test("inventory: forged mode and oversized amount are rejected", () => {
  assert.equal(validateInventoryInput({ mode: "RESET", amount: "5" }).ok, false);
  assert.equal(validateInventoryInput({ mode: "RESTOCK", amount: "99999999" }).ok, false);
  assert.equal(validateInventoryInput({ mode: "RESTOCK", amount: "abc" }).ok, false);
});

test("applyInventoryChange: guards against negative and below-reserved stock", () => {
  assert.deepEqual(applyInventoryChange({ quantity: 10, reservedQuantity: 2 }, 5), {
    ok: true,
    quantity: 15,
  });
  assert.deepEqual(applyInventoryChange({ quantity: 10, reservedQuantity: 2 }, -3), {
    ok: true,
    quantity: 7,
  });
  assert.deepEqual(applyInventoryChange({ quantity: 2, reservedQuantity: 0 }, -5), {
    ok: false,
    reason: "NEGATIVE",
  });
  // 5 reserved → cannot drop on-hand to 3
  assert.deepEqual(applyInventoryChange({ quantity: 6, reservedQuantity: 5 }, -2), {
    ok: false,
    reason: "BELOW_RESERVED",
  });
});

// ── Publish / delete guards ─────────────────────────────────────────────

test("publish readiness is advisory: variant-less products are flagged, never blocked here", () => {
  assert.equal(evaluateProductPublish({ variantCount: 0 }).allowed, false);
  assert.equal(evaluateProductPublish({ variantCount: 1 }).allowed, true);
});

test("product deletion blocked by order history only", () => {
  assert.equal(evaluateProductDeletion({ orderItemCount: 1 }).allowed, false);
  assert.equal(evaluateProductDeletion({ orderItemCount: 0 }).allowed, true);
});

test("variant deletion blocked by order history or live carts", () => {
  assert.equal(evaluateVariantDeletion({ orderItemCount: 1, cartItemCount: 0 }).allowed, false);
  assert.equal(evaluateVariantDeletion({ orderItemCount: 0, cartItemCount: 2 }).allowed, false);
  assert.equal(evaluateVariantDeletion({ orderItemCount: 0, cartItemCount: 0 }).allowed, true);
});

// ── Authorization ───────────────────────────────────────────────────────

test("cost price is ADMIN-only; other roles are denied", () => {
  assert.equal(canViewCostPrice("ADMIN"), true);
  for (const role of ["STAFF", "CUSTOMER", "admin", "SUPERADMIN", ""]) {
    assert.equal(canViewCostPrice(role), false, role);
  }
});

test("product mutations accept exactly the existing admin-capable roles", () => {
  for (const role of ["ADMIN", "STAFF"]) assert.equal(isAdminCapableRole(role), true);
  for (const role of ["CUSTOMER", "admin", "", "SUPERADMIN"]) assert.equal(isAdminCapableRole(role), false);
});

// ── Error copy completeness ─────────────────────────────────────────────

test("every product error code carries Persian copy (no raw DB errors)", () => {
  const codes = [
    "FORBIDDEN",
    "VALIDATION",
    "NOT_FOUND",
    "DUPLICATE_SLUG",
    "DUPLICATE_SKU",
    "DUPLICATE_BARCODE",
    "DUPLICATE_SPEC_KEY",
    "HAS_ORDER_HISTORY",
    "IN_USE",
    "INVALID_CATEGORY",
    "INVALID_VARIANT",
    "MEDIA_LIMIT",
    "INVENTORY_BELOW_RESERVED",
    "INVENTORY_NEGATIVE",
    "DB_ERROR",
  ];
  for (const code of codes) {
    assert.equal(typeof PRODUCT_ERROR_MESSAGES[code], "string", code);
    assert.ok(PRODUCT_ERROR_MESSAGES[code].length > 0, code);
  }
});