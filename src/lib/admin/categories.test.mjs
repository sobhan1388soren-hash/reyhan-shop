// Unit tests — Phase 14-B category admin rules (pure logic, DB-free).
// Covers input validation/normalization (name/slug/status/sortOrder/image
// URL), Persian-digit tolerance, hierarchy safety (self-parent, descendant
// cycles, unknown parents), subtree level recomputation, the conservative
// deletion guard, and the deny-by-default mutation authorization decision
// (the same ADMIN/STAFF allow-list as the rest of the admin console).
//
// Run: npm run test:admin   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateCategoryInput,
  normalizeCategorySlug,
  parseStrictInt,
  toLatinDigits,
  collectDescendantIds,
  validateParentAssignment,
  recomputeSubtreeLevels,
  evaluateCategoryDeletion,
  buildCategoryTree,
  CATEGORY_ERROR_MESSAGES,
} from "./category-rules.ts";
import { isAdminCapableRole } from "./rules.ts";

const valid = {
  name: "دستگاه تصفیه آب",
  slug: "دستگاه-تصفیه-آب",
  parentId: "",
  description: "",
  image: "",
  status: "ACTIVE",
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
};

// ── Input validation ────────────────────────────────────────────────────

test("create: a valid category normalizes with root parent and defaults", () => {
  const result = validateCategoryInput(valid);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.parentId, null);
    assert.equal(result.data.status, "ACTIVE");
    assert.equal(result.data.sortOrder, 0);
    assert.equal(result.data.description, null);
    assert.equal(result.data.image, null);
  }
});

test("empty name is rejected with a field error", () => {
  const result = validateCategoryInput({ ...valid, name: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.name);
});

test("oversized name is rejected", () => {
  const result = validateCategoryInput({ ...valid, name: "ا".repeat(121) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.name);
});

test("slug falls back to the name and is normalized (lowercase, hyphens)", () => {
  const result = validateCategoryInput({ ...valid, slug: "", name: "Water Filters  Pro" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.slug, "water-filters-pro");
    assert.equal(result.data.name, "Water Filters Pro");
  }
});

test("explicit slug is normalized, junk-only slug rejected", () => {
  const ok = validateCategoryInput({ ...valid, slug: "  آبسنگ-شیرین  " });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.slug, "آبسنگ-شیرین");

  const bad = validateCategoryInput({ ...valid, slug: "!!!---!!!", name: "d" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.slug);
});

test("image must be http(s) or a root-relative path", () => {
  for (const image of ["https://cdn.example/x.jpg", "/img/cat.jpg"]) {
    const result = validateCategoryInput({ ...valid, image });
    assert.equal(result.ok, true, image);
  }
  for (const image of ["javascript:alert(1)", "ftp://x/y", "cdn.example/x.jpg"]) {
    const result = validateCategoryInput({ ...valid, image });
    assert.equal(result.ok, false, image);
    if (!result.ok) assert.ok(result.errors.image);
  }
});

test("status accepts only the existing enum strings (case-tolerant), forged → error", () => {
  assert.equal(validateCategoryInput({ ...valid, status: "active" }).ok, true);
  const inactive = validateCategoryInput({ ...valid, status: "INACTIVE" });
  assert.equal(inactive.ok, true);
  if (inactive.ok) assert.equal(inactive.data.status, "INACTIVE");
  const forged = validateCategoryInput({ ...valid, status: "PUBLISHED" });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.ok(forged.errors.status);
});

test("sortOrder accepts Latin and Persian digits; non-numbers/out-of-range rejected", () => {
  const fa = validateCategoryInput({ ...valid, sortOrder: "۱۲" });
  assert.equal(fa.ok, true);
  if (fa.ok) assert.equal(fa.data.sortOrder, 12);

  const negative = validateCategoryInput({ ...valid, sortOrder: "-3" });
  assert.equal(negative.ok, true);
  if (negative.ok) assert.equal(negative.data.sortOrder, -3);

  assert.equal(validateCategoryInput({ ...valid, sortOrder: "abc" }).ok, false);
  assert.equal(validateCategoryInput({ ...valid, sortOrder: "1.5" }).ok, false);
  assert.equal(validateCategoryInput({ ...valid, sortOrder: "99999999" }).ok, false);
});

test("oversized SEO fields are rejected", () => {
  assert.ok(
    (() => {
      const r = validateCategoryInput({ ...valid, seoTitle: "ت".repeat(121) });
      return !r.ok && "seoTitle" in r.errors;
    })()
  );
  assert.ok(
    (() => {
      const r = validateCategoryInput({ ...valid, seoDescription: "ت".repeat(301) });
      return !r.ok && "seoDescription" in r.errors;
    })()
  );
});

test("toLatinDigits + parseStrictInt handle Persian/Arabic digits", () => {
  assert.equal(toLatinDigits("۱۲۳٤٥"), "12345");
  assert.equal(parseStrictInt(" ۴۲ "), 42);
  assert.equal(parseStrictInt("-۷"), -7);
  assert.equal(parseStrictInt("۱۲x"), null);
  assert.equal(parseStrictInt(""), null);
});

test("normalizeCategorySlug mirrors the catalog slugify conventions", () => {
  assert.equal(normalizeCategorySlug("  Water  Filter!!  "), "water-filter");
  assert.equal(normalizeCategorySlug("فیلتر رسوبی"), "فیلتر-رسوبی");
  assert.equal(normalizeCategorySlug("--a--b--"), "a-b");
});

// ── Hierarchy ───────────────────────────────────────────────────────────

const rows = [
  { id: "a", parentId: null },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
  { id: "d", parentId: null },
];

test("collectDescendantIds walks the full subtree and is cycle-safe", () => {
  assert.deepEqual([...collectDescendantIds(rows, "a")].sort(), ["b", "c"]);
  assert.equal(collectDescendantIds(rows, "d").size, 0);
  // Corrupted cycle a->b->a must not loop forever (defensive: it just
  // reports both as reachable from the queue walk).
  const cyclic = [
    { id: "a", parentId: "b" },
    { id: "b", parentId: "a" },
  ];
  assert.deepEqual([...collectDescendantIds(cyclic, "a")].sort(), ["a", "b"]);
});

test("self-parent is rejected", () => {
  assert.equal(validateParentAssignment(rows, "a", "a"), "SELF");
});

test("moving under a descendant (cycle) is rejected", () => {
  assert.equal(validateParentAssignment(rows, "a", "c"), "DESCENDANT");
  assert.equal(validateParentAssignment(rows, "b", "c"), "DESCENDANT");
});

test("unknown/forged parent ids are rejected", () => {
  assert.equal(validateParentAssignment(rows, "a", "does-not-exist"), "UNKNOWN_PARENT");
});

test("valid reparents pass: sibling move and root move", () => {
  assert.equal(validateParentAssignment(rows, "c", "d"), null);
  assert.equal(validateParentAssignment(rows, "c", null), null);
});

test("recomputeSubtreeLevels shifts only the rows that change", () => {
  const levelRows = [
    { id: "a", parentId: null, level: 0 },
    { id: "b", parentId: "a", level: 1 },
    { id: "c", parentId: "b", level: 2 },
    { id: "d", parentId: null, level: 0 },
  ];
  // Move subtree c under d: root stays (passed newLevel matching), children change.
  const changes = recomputeSubtreeLevels(
    levelRows.map((r) => (r.id === "c" ? { ...r, parentId: "d", level: 1 } : r)),
    "c",
    1
  );
  assert.deepEqual(changes, []);

  // Move subtree b (with c) under d → b level 1, c level 2 (both already),
  // so nothing changes when consistent; when inconsistent it reports fixes.
  const broken = [
    { id: "b", parentId: "d", level: 5 },
    { id: "c", parentId: "b", level: 9 },
  ];
  const fixes = recomputeSubtreeLevels(
    [...levelRows.filter((r) => r.id !== "b" && r.id !== "c"), ...broken],
    "b",
    1
  );
  assert.deepEqual(
    fixes.sort((x, y) => x.id.localeCompare(y.id)),
    [
      { id: "b", level: 1 },
      { id: "c", level: 2 },
    ]
  );
});

test("buildCategoryTree nests rows into ordered roots", () => {
  const nodes = [
    { id: "a", parentId: null, name: "A" },
    { id: "b", parentId: "a", name: "B" },
    { id: "d", parentId: null, name: "D" },
  ];
  const tree = buildCategoryTree(nodes);
  assert.deepEqual(tree.map((t) => t.id), ["a", "d"]);
  assert.deepEqual(tree[0].children.map((c) => c.id), ["b"]);
});

// ── Deletion guard ──────────────────────────────────────────────────────

test("deletion blocked by children; message guides to move-or-deactivate", () => {
  const blocked = evaluateCategoryDeletion({ childCount: 2, productCount: 0 });
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.reason, "HAS_CHILDREN");
  assert.ok(CATEGORY_ERROR_MESSAGES.HAS_CHILDREN.length > 0);
});

test("deletion blocked by product associations", () => {
  const blocked = evaluateCategoryDeletion({ childCount: 0, productCount: 1 });
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.reason, "HAS_PRODUCTS");
});

test("leaf category with no products is deletable", () => {
  assert.deepEqual(evaluateCategoryDeletion({ childCount: 0, productCount: 0 }), {
    allowed: true,
  });
});

// ── Authorization (service contract: existing ADMIN/STAFF allow-list) ──

test("category mutations accept exactly the admin-capable roles", () => {
  for (const role of ["ADMIN", "STAFF"]) assert.equal(isAdminCapableRole(role), true);
  for (const role of ["CUSTOMER", "admin", "SUPERADMIN", ""])
    assert.equal(isAdminCapableRole(role), false);
});

test("every category error code carries Persian copy (no raw DB errors)", () => {
  for (const code of [
    "FORBIDDEN",
    "VALIDATION",
    "NOT_FOUND",
    "DUPLICATE_SLUG",
    "INVALID_PARENT",
    "HAS_CHILDREN",
    "HAS_PRODUCTS",
    "DB_ERROR",
  ]) {
    assert.equal(typeof CATEGORY_ERROR_MESSAGES[code], "string");
    assert.ok(CATEGORY_ERROR_MESSAGES[code].length > 0, code);
  }
});
