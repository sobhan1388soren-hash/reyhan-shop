// Regression tests for Admin Server/Client boundary fixes.
//
// The bug: server pages imported draftFrom*/empty* helpers from "use client"
// form modules and called/used them on the server, which Next.js rejects
// ("Attempted to call draftFromProduct() from the server but draftFromProduct
// is on the client"). The helpers now live in plain server-safe modules; these
// tests pin their behavior so the forms receive correctly prepared drafts.

import test from "node:test";
import assert from "node:assert/strict";

import {
  draftFromProduct,
  emptyProductDraft,
} from "../../components/admin/product-draft.ts";
import {
  draftFromBanner,
  emptyBannerDraft,
} from "../../components/admin/banner-draft.ts";
import {
  draftFromDiscount,
  emptyDiscountDraft,
} from "../../components/admin/discount-draft.ts";
import {
  draftFromPost,
  emptyPostDraft,
} from "../../components/admin/post-draft.ts";
import { buildCategoryTree } from "./category-rules.ts";

test("draftFromProduct maps a detail row into an edit draft", () => {
  const draft = draftFromProduct({
    id: "p1",
    title: "t",
    slug: "product",
    status: "ACTIVE",
    isFeatured: true,
    shortDescription: null,
    description: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    categories: [{ id: "c1" }, { id: "c2" }],
  });
  assert.equal(draft.mode, "edit");
  assert.equal(draft.productId, "p1");
  assert.equal(draft.title, "t");
  assert.equal(draft.shortDescription, "");
  assert.deepEqual(draft.categoryIds, ["c1", "c2"]);
});

test("emptyProductDraft is a valid create-mode draft", () => {
  assert.equal(emptyProductDraft.mode, "create");
  assert.equal(emptyProductDraft.productId, undefined);
  assert.deepEqual(emptyProductDraft.categoryIds, []);
});

test("draftFromBanner normalizes nullables to form strings", () => {
  const draft = draftFromBanner({
    placement: "HERO",
    title: "b",
    description: null,
    imageUrl: null,
    primaryLinkLabel: null,
    primaryLinkHref: null,
    secondaryLinkLabel: null,
    secondaryLinkHref: null,
    isActive: true,
    sortOrder: 3,
  });
  assert.equal(draft.description, "");
  assert.equal(draft.sortOrder, "3");
  assert.equal(emptyBannerDraft.placement, "PROMO");
});

test("draftFromDiscount converts rials to tomans and keeps ISO dates", () => {
  const draft = draftFromDiscount({
    code: "SAVE",
    type: "FIXED_AMOUNT",
    value: 100000,
    minOrderAmount: 500000,
    maxDiscountAmount: null,
    maxUses: 10,
    maxUsesPerUser: null,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: null,
    isActive: true,
  });
  assert.equal(draft.value, "10000");
  assert.equal(draft.minOrderAmount, "50000");
  assert.equal(draft.maxDiscountAmount, "");
  assert.equal(draft.maxUses, "10");
  assert.equal(draft.startsAt, "2026-01-01");
  assert.equal(draft.endsAt, "");
  assert.equal(emptyDiscountDraft.type, "PERCENTAGE");
});

test("draftFromDiscount keeps percentage values as-is", () => {
  const draft = draftFromDiscount({
    code: "P",
    type: "PERCENTAGE",
    value: 20,
    minOrderAmount: null,
    maxDiscountAmount: null,
    maxUses: null,
    maxUsesPerUser: null,
    startsAt: null,
    endsAt: null,
    isActive: false,
  });
  assert.equal(draft.value, "20");
  assert.equal(draft.isActive, false);
});

test("draftFromPost flattens nulls and category ids", () => {
  const draft = draftFromPost({
    title: "t",
    slug: "s",
    excerpt: null,
    content: "c",
    coverImage: null,
    status: "DRAFT",
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    authorId: null,
    categories: [{ id: "a" }, { id: "b" }],
  });
  assert.equal(draft.authorId, "");
  assert.equal(draft.excerpt, "");
  assert.deepEqual(draft.categoryIds, ["a", "b"]);
  const empty = emptyPostDraft();
  assert.equal(empty.status, "DRAFT");
  assert.deepEqual(empty.categoryIds, []);
});

test("buildCategoryTree preserves scalar fields the pages pre-compute (itemCount)", () => {
  const rows = [
    { id: "1", parentId: null, sortOrder: 0, name: "a", itemCount: 5 },
    { id: "2", parentId: "1", sortOrder: 0, name: "b", itemCount: 7 },
  ];
  const tree = buildCategoryTree(rows);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].itemCount, 5);
  assert.equal(tree[0].children[0].itemCount, 7);
});
