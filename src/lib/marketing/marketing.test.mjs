// Unit tests — Phase 16 homepage marketing (pure logic, DB-free).
//
// Covers:
//   - banner input validation/normalization (placement allow-list, title &
//     text caps, image-URL scheme policy, link-href scheme policy, paired
//     CTA label/href, sortOrder)
//   - storefront hero resolution: no active hero → factual defaults; a
//     stored row merges with defaults; secondary CTA needs both fields
//   - promo banner view shaping (link optional)
//   - the best-selling rank-merge: rank order preserved, absent products
//     dropped, result capped
//   - error-copy completeness
//
// Run: npm run test:marketing   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateBannerInput,
  resolveHeroContent,
  toPromoBannerView,
  isBannerPlacement,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  BANNER_TITLE_MAX,
  BANNER_DESCRIPTION_MAX,
  BANNER_LINK_LABEL_MAX,
  BANNER_ERROR_MESSAGES,
  HERO_DEFAULTS,
} from "./banner-rules.ts";
import { selectRankedProducts } from "./ranking.ts";

const validInput = {
  placement: "PROMO",
  title: "جشنواره آب پاک",
  description: "تخفیف ویژه فیلترهای جایگزین.",
  imageUrl: "https://example.com/banner.jpg",
  primaryLinkLabel: "مشاهده محصولات",
  primaryLinkHref: "/products",
  secondaryLinkLabel: "",
  secondaryLinkHref: "",
  isActive: "true",
  sortOrder: "1",
};

// ── Placement allow-list ────────────────────────────────────────────────

test("placement allow-list accepts the real values and rejects unknown ones", () => {
  assert.deepEqual([...BANNER_PLACEMENTS], ["HERO", "PROMO"]);
  assert.equal(isBannerPlacement("HERO"), true);
  assert.equal(isBannerPlacement("PROMO"), true);
  assert.equal(isBannerPlacement("FOOTER"), false);
  assert.equal(isBannerPlacement(""), false);
  assert.equal(BANNER_PLACEMENT_LABELS.HERO.length > 0, true);
  assert.equal(BANNER_PLACEMENT_LABELS.PROMO.length > 0, true);
});

// ── Banner input validation ─────────────────────────────────────────────

test("valid promo input normalizes successfully", () => {
  const result = validateBannerInput(validInput);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.placement, "PROMO");
    assert.equal(result.data.title, "جشنواره آب پاک");
    assert.equal(result.data.description, "تخفیف ویژه فیلترهای جایگزین.");
    assert.equal(result.data.imageUrl, "https://example.com/banner.jpg");
    assert.equal(result.data.primaryLinkLabel, "مشاهده محصولات");
    assert.equal(result.data.primaryLinkHref, "/products");
    assert.equal(result.data.secondaryLinkHref, null);
    assert.equal(result.data.secondaryLinkLabel, null);
    assert.equal(result.data.isActive, true);
    assert.equal(result.data.sortOrder, 1);
  }
});

test("missing isActive defaults to active (create flow convenience)", () => {
  const result = validateBannerInput({ ...validInput, isActive: undefined });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.isActive, true);
});

test("empty title is rejected", () => {
  const result = validateBannerInput({ ...validInput, title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.title);
});

test("oversized title is rejected", () => {
  const result = validateBannerInput({ ...validInput, title: "ا".repeat(BANNER_TITLE_MAX + 1) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.title);
});

test("oversized description is rejected", () => {
  const result = validateBannerInput({
    ...validInput,
    description: "ا".repeat(BANNER_DESCRIPTION_MAX + 1),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.description);
});

test("unknown placement is rejected", () => {
  const result = validateBannerInput({ ...validInput, placement: "SIDEBAR" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.placement);
});

test("javascript: image URL is rejected", () => {
  const result = validateBannerInput({ ...validInput, imageUrl: "javascript:alert(1)" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.imageUrl);
});

test("protocol-relative image URL is rejected", () => {
  const result = validateBannerInput({ ...validInput, imageUrl: "//evil.com/x.jpg" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.imageUrl);
});

test("root-relative image URL is accepted", () => {
  const result = validateBannerInput({ ...validInput, imageUrl: "/images/banner.jpg" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.imageUrl, "/images/banner.jpg");
});

test("empty image URL stays null (branded fallback on the storefront)", () => {
  const result = validateBannerInput({ ...validInput, imageUrl: "  " });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.imageUrl, null);
});

test("javascript: link href is rejected", () => {
  const result = validateBannerInput({ ...validInput, primaryLinkHref: "javascript:alert(1)" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.primaryLinkHref);
});

test("data: link href is rejected", () => {
  const result = validateBannerInput({ ...validInput, primaryLinkHref: "data:text/html,<script>" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.primaryLinkHref);
});

test("absolute https link href is accepted", () => {
  const result = validateBannerInput({ ...validInput, primaryLinkHref: "https://example.com/shop" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.primaryLinkHref, "https://example.com/shop");
});

test("link label without href is rejected (pairing)", () => {
  const result = validateBannerInput({
    ...validInput,
    primaryLinkLabel: "مشاهده",
    primaryLinkHref: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.primaryLinkHref);
});

test("link href without label is rejected (pairing)", () => {
  const result = validateBannerInput({
    ...validInput,
    primaryLinkLabel: "",
    primaryLinkHref: "/products",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.primaryLinkLabel);
});

test("oversized link label is rejected", () => {
  const result = validateBannerInput({
    ...validInput,
    primaryLinkLabel: "ا".repeat(BANNER_LINK_LABEL_MAX + 1),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.primaryLinkLabel);
});

test("secondary CTA pairing is enforced for hero", () => {
  const ok = validateBannerInput({
    ...validInput,
    placement: "HERO",
    secondaryLinkLabel: "مطالعه مقالات",
    secondaryLinkHref: "/blog",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.secondaryLinkHref, "/blog");
    assert.equal(ok.data.secondaryLinkLabel, "مطالعه مقالات");
  }

  const bad = validateBannerInput({
    ...validInput,
    placement: "HERO",
    secondaryLinkLabel: "مطالعه مقالات",
    secondaryLinkHref: "",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.secondaryLinkHref);
});

test("non-string and junk inputs never throw", () => {
  const result = validateBannerInput({
    placement: 42,
    title: null,
    description: undefined,
    imageUrl: {},
    primaryLinkHref: 7,
    primaryLinkLabel: [],
    secondaryLinkHref: false,
    secondaryLinkLabel: {},
    isActive: "on",
    sortOrder: "abc",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.placement);
    assert.ok(result.errors.title);
  }
});

test("persian digits in sortOrder are parsed", () => {
  const result = validateBannerInput({ ...validInput, sortOrder: "۱۲" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.sortOrder, 12);
});

test("unparseable sortOrder falls back to zero, not an error", () => {
  const result = validateBannerInput({ ...validInput, sortOrder: "" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.sortOrder, 0);
});

// ── Hero resolution ─────────────────────────────────────────────────────

test("no active hero resolves to the factual defaults", () => {
  const hero = resolveHeroContent(null);
  assert.equal(hero.title, HERO_DEFAULTS.title);
  assert.equal(hero.description, HERO_DEFAULTS.description);
  assert.equal(hero.primaryLinkHref, HERO_DEFAULTS.primaryLinkHref);
  assert.equal(hero.primaryLinkLabel, HERO_DEFAULTS.primaryLinkLabel);
  assert.equal(hero.secondaryLinkHref, HERO_DEFAULTS.secondaryLinkHref);
  assert.equal(hero.secondaryLinkLabel, HERO_DEFAULTS.secondaryLinkLabel);
  assert.equal(hero.imageUrl, null);
});

test("a stored hero row is used as-is when complete", () => {
  const hero = resolveHeroContent({
    title: "آب پاک برای خانه سالم",
    description: "توضیف اختصاصی هیرو.",
    imageUrl: "https://example.com/hero.jpg",
    primaryLinkLabel: "خرید دستگاه",
    primaryLinkHref: "/categories/water-purification-devices",
    secondaryLinkLabel: "راهنمای خرید",
    secondaryLinkHref: "/blog",
  });
  assert.equal(hero.title, "آب پاک برای خانه سالم");
  assert.equal(hero.imageUrl, "https://example.com/hero.jpg");
  assert.equal(hero.primaryLinkHref, "/categories/water-purification-devices");
  assert.equal(hero.secondaryLinkLabel, "راهنمای خرید");
});

test("a stored hero row with empty CTAs falls back to the default primary path", () => {
  const hero = resolveHeroContent({
    title: "هیرو سفارشی",
    description: null,
    imageUrl: null,
    primaryLinkLabel: "  ",
    primaryLinkHref: "",
    secondaryLinkLabel: null,
    secondaryLinkHref: null,
  });
  assert.equal(hero.title, "هیرو سفارشی");
  assert.equal(hero.description, HERO_DEFAULTS.description);
  assert.equal(hero.primaryLinkLabel, HERO_DEFAULTS.primaryLinkLabel);
  assert.equal(hero.primaryLinkHref, HERO_DEFAULTS.primaryLinkHref);
  assert.equal(hero.secondaryLinkLabel, null);
  assert.equal(hero.secondaryLinkHref, null);
});

test("hero secondary CTA is dropped unless BOTH label and href exist", () => {
  const partial = resolveHeroContent({
    title: "هیرو",
    description: null,
    imageUrl: null,
    primaryLinkLabel: "برو",
    primaryLinkHref: "/products",
    secondaryLinkLabel: "تنها برچسب",
    secondaryLinkHref: "",
  });
  assert.equal(partial.secondaryLinkLabel, null);
  assert.equal(partial.secondaryLinkHref, null);
});

// ── Promo view shaping ──────────────────────────────────────────────────

test("promo view keeps a usable link", () => {
  const view = toPromoBannerView({
    id: "b1",
    title: "جشنواره",
    description: "توضیح",
    imageUrl: "https://example.com/b.jpg",
    primaryLinkHref: "/products",
    primaryLinkLabel: "مشاهده",
  });
  assert.equal(view.id, "b1");
  assert.equal(view.linkHref, "/products");
  assert.equal(view.linkLabel, "مشاهده");
});

test("promo view degrades to a linkless banner when the link is absent", () => {
  const view = toPromoBannerView({
    id: "b2",
    title: "اطلاعیه",
    description: null,
    imageUrl: null,
    primaryLinkHref: null,
    primaryLinkLabel: null,
  });
  assert.equal(view.linkHref, null);
  assert.equal(view.linkLabel, null);
  assert.equal(view.imageUrl, null);
});

// ── Best-selling rank merge ─────────────────────────────────────────────

test("rank merge preserves sales order and caps the result", () => {
  const ranked = [
    { productId: "p3" },
    { productId: "p1" },
    { productId: "p2" },
    { productId: "p4" },
  ];
  const products = [
    { id: "p1", title: "A" },
    { id: "p2", title: "B" },
    { id: "p3", title: "C" },
    { id: "p4", title: "D" },
  ];
  const out = selectRankedProducts(ranked, products, 3);
  assert.deepEqual(
    out.map((p) => p.id),
    ["p3", "p1", "p2"]
  );
});

test("rank merge skips ranked ids whose product is no longer active", () => {
  const ranked = [{ productId: "p2" }, { productId: "gone" }, { productId: "p1" }];
  const products = [
    { id: "p1", title: "A" },
    { id: "p2", title: "B" },
  ];
  const out = selectRankedProducts(ranked, products, 8);
  assert.deepEqual(
    out.map((p) => p.id),
    ["p2", "p1"]
  );
});

test("rank merge with no sales returns nothing", () => {
  const out = selectRankedProducts([], [{ id: "p1" }], 8);
  assert.equal(out.length, 0);
});

test("rank merge never exceeds the requested take", () => {
  const ranked = [{ productId: "p1" }, { productId: "p2" }];
  const products = [{ id: "p1" }, { id: "p2" }];
  assert.equal(selectRankedProducts(ranked, products, 0).length, 0);
  assert.equal(selectRankedProducts(ranked, products, 1).length, 1);
});

// ── Error copy completeness ─────────────────────────────────────────────

test("every banner error code has Persian copy", () => {
  const codes = ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "DB_ERROR"];
  const messages = /** @type {Record<string, string>} */ (BANNER_ERROR_MESSAGES);
  for (const code of codes) {
    assert.ok(messages[code], `missing Persian copy for ${code}`);
  }
});
