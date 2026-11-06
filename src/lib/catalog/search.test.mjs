// Unit tests — search term parsing and URL conversion.
//
// Tests cover:
//   - parseSearchTerm
//   - buildSearchWhere
//   - searchToQueryString
//
// Run: node --test src/lib/catalog/search.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { parseSearchTerm, buildSearchWhere, searchToQueryString } from "./search.ts";

test("parseSearchTerm: trims and caps at 100 chars", () => {
  assert.equal(parseSearchTerm("  hello  "), "hello");
  assert.equal(parseSearchTerm("test"), "test");
});

test("parseSearchTerm: empty/undefined returns undefined", () => {
  assert.equal(parseSearchTerm(""), undefined);
  assert.equal(parseSearchTerm("   "), undefined);
  assert.equal(parseSearchTerm(undefined), undefined);
});

test("parseSearchTerm: caps at 100 characters", () => {
  const long = "a".repeat(150);
  const result = parseSearchTerm(long);
  assert.equal(result.length, 100);
  assert.equal(result, "a".repeat(100));
});

test("buildSearchWhere: undefined term returns undefined", () => {
  assert.equal(buildSearchWhere(undefined), undefined);
  assert.equal(buildSearchWhere(""), undefined);
  assert.equal(buildSearchWhere("   "), undefined);
});

test("buildSearchWhere: valid term produces OR clause over title/description/shortDescription/slug/seoKeywords", () => {
  const result = buildSearchWhere("crystal");
  assert.ok(result);
  assert.ok(result.OR);
  assert.ok(Array.isArray(result.OR));

  const fields = result.OR.map((clause) => Object.keys(clause)[0]);
  assert.ok(fields.includes("title"), "should search title");
  assert.ok(fields.includes("description"), "should search description");
  assert.ok(fields.includes("shortDescription"), "should search shortDescription");
  assert.ok(fields.includes("slug"), "should search slug");
  assert.ok(fields.includes("seoKeywords"), "should search seoKeywords");

  // Check that all use case-insensitive contains
  for (const clause of result.OR) {
    const key = Object.keys(clause)[0];
    assert.ok(clause[key].mode === "insensitive", `${key} should be case-insensitive`);
    assert.equal(clause[key].contains, "crystal");
  }
});

test("buildSearchWhere: Persian search term preserved", () => {
  const persian = "بلور";
  const result = buildSearchWhere(persian);
  assert.ok(result);
  const titleClause = result.OR.find((c) => c.title);
  assert.equal(titleClause.title.contains, persian);
});

test("searchToQueryString: round-trips through parseSearchTerm", () => {
  assert.equal(searchToQueryString("test"), "test");
  assert.equal(searchToQueryString("  trimmed  "), "trimmed");
  assert.equal(searchToQueryString(""), "");
  assert.equal(searchToQueryString(undefined), "");
});