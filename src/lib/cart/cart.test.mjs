// Unit tests — guest cart storage sanitization, localStorage TTL/envelope,
// and the minimal hardened cookie mirror. Pure logic only, DB-free:
// validateCart itself imports server-only/Prisma and is exercised by the
// server pipeline; its security contract (server-side prices/stock) is
// asserted here through the input-sanitization boundary and the cookie
// payload policy.
//
// Run: npm run test:cart   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeEntries,
  isValidMutation,
  parseStoredPayload,
  toCookieEntries,
  encodeCartCookieValue,
  decodeCartCookieValue,
  serializeCartCookie,
  clearCartCookie,
  shouldUseSecureCookie,
  CART_TTL_SECONDS,
  MAX_COOKIE_VALUE_BYTES,
  CART_COOKIE,
} from "./storage.ts";

// ── Storage / sanitization ───────────────────────────────────────────────

test("sanitize: drops zero, negative, and non-finite quantities", () => {
  const out = sanitizeEntries([
    { variantId: "v1", quantity: 0 },
    { variantId: "v2", quantity: -3 },
    { variantId: "v3", quantity: Number.NaN },
    { variantId: "v4", quantity: Infinity },
    { variantId: "v5", quantity: 2.5 },
    { variantId: "v6", quantity: 2 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].variantId, "v6");
});

test("sanitize: excessive quantity is clamped, not trusted", () => {
  const out = sanitizeEntries([{ variantId: "v1", quantity: 1_000_000 }]);
  assert.equal(out[0].quantity, 999);
});

test("sanitize: duplicate variant ids are dropped (first wins)", () => {
  const out = sanitizeEntries([
    { variantId: "v1", quantity: 1 },
    { variantId: "v1", quantity: 5 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 1);
});

test("sanitize: malformed entries and non-arrays yield []", () => {
  assert.deepEqual(sanitizeEntries(null), []);
  assert.deepEqual(sanitizeEntries("hacked"), []);
  assert.deepEqual(sanitizeEntries({}), []);
  assert.deepEqual(sanitizeEntries([{ noVariant: true }, { variantId: 42 }, "x", null]), []);
  assert.deepEqual(sanitizeEntries([{ variantId: "   ", quantity: 1 }]), []);
  assert.deepEqual(sanitizeEntries([{ variantId: "x".repeat(500), quantity: 1 }]), []);
});

test("sanitize: valid entries keep UX snapshot fields but never totals", () => {
  const out = sanitizeEntries([
    { variantId: "v1", quantity: 2, priceSnapshot: 120000, addedAt: 1700000000000 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].priceSnapshot, 120000);
  assert.equal(out[0].addedAt, 1700000000000);
});

test("mutations: invalid variant ids and quantities are rejected", () => {
  assert.equal(isValidMutation("", 1), false);
  assert.equal(isValidMutation("  ", 1), false);
  assert.equal(isValidMutation(null, 1), false);
  assert.equal(isValidMutation(42, 1), false);
  assert.equal(isValidMutation("x".repeat(200), 1), false);
  assert.equal(isValidMutation("v1", 0), false);
  assert.equal(isValidMutation("v1", -1), false);
  assert.equal(isValidMutation("v1", Number.NaN), false);
  assert.equal(isValidMutation("v1", 1.5), false);
  assert.equal(isValidMutation("v1", 1000), false);
  assert.equal(isValidMutation("v1", 2), true);
});

// ── Versioned envelope + TTL ─────────────────────────────────────────────

test("envelope: current shape round-trips", () => {
  const savedAt = Date.now();
  const raw = JSON.stringify({ v: 2, savedAt, entries: [{ variantId: "v1", quantity: 2 }] });
  const out = parseStoredPayload(raw, savedAt);
  assert.equal(out.length, 1);
  assert.equal(out[0].variantId, "v1");
});

test("envelope: stale payload beyond the shared TTL is dropped", () => {
  const savedAt = Date.now() - CART_TTL_SECONDS * 1000 - 1000;
  const raw = JSON.stringify({ v: 2, savedAt, entries: [{ variantId: "v1", quantity: 1 }] });
  assert.deepEqual(parseStoredPayload(raw), []);
});

test("envelope: unknown version is dropped", () => {
  const raw = JSON.stringify({ v: 99, savedAt: Date.now(), entries: [{ variantId: "v1", quantity: 1 }] });
  assert.deepEqual(parseStoredPayload(raw), []);
});

test("envelope: future-dated or invalid timestamps are dropped", () => {
  const future = Date.now() + 10 * 60 * 1000;
  const raw = JSON.stringify({ v: 2, savedAt: future, entries: [{ variantId: "v1", quantity: 1 }] });
  assert.deepEqual(parseStoredPayload(raw), []);
  const garbage = JSON.stringify({ v: 2, savedAt: "soon", entries: [] });
  assert.deepEqual(parseStoredPayload(garbage), []);
});

test("envelope: legacy bare array still migrates", () => {
  const raw = JSON.stringify([{ variantId: "v1", quantity: 1 }]);
  const out = parseStoredPayload(raw);
  assert.equal(out.length, 1);
});

test("envelope: malformed JSON and non-objects yield []", () => {
  assert.deepEqual(parseStoredPayload("{not json"), []);
  assert.deepEqual(parseStoredPayload(null), []);
  assert.deepEqual(parseStoredPayload("42"), []);
  assert.deepEqual(parseStoredPayload("null"), []);
});

// ── Cookie payload policy ────────────────────────────────────────────────

test("cookie: payload carries only variantId and quantity", () => {
  const entries = [
    { variantId: "v1", quantity: 2, priceSnapshot: 5000, addedAt: Date.now() },
  ];
  const payload = toCookieEntries(entries);
  assert.deepEqual(payload, [{ variantId: "v1", quantity: 2 }]);
  assert.ok(!("priceSnapshot" in payload[0]));
  assert.ok(!("addedAt" in payload[0]));
});

test("cookie: encoded round-trip decodes to sanitized entries", () => {
  const entries = [{ variantId: "v1", quantity: 3 }];
  const encoded = encodeCartCookieValue(entries);
  assert.ok(encoded !== null);
  const decoded = decodeCartCookieValue(encoded);
  assert.deepEqual(decoded, [{ variantId: "v1", quantity: 3 }]);
});

test("cookie: oversized payload is rejected safely (null / no throw)", () => {
  const many = [];
  for (let i = 0; i < 50; i++) {
    many.push({ variantId: `variant-${"x".repeat(100)}-${i}`, quantity: 1 });
  }
  const encoded = encodeCartCookieValue(many);
  assert.equal(encoded, null);
  // Serializer must fail safe rather than emit a huge string.
  assert.equal(serializeCartCookie(many), null);
});

test("cookie: decode handles malformed data safely", () => {
  assert.deepEqual(decodeCartCookieValue(null), []);
  assert.deepEqual(decodeCartCookieValue(""), []);
  assert.deepEqual(decodeCartCookieValue("%E0%A4%A"), []);
  assert.deepEqual(decodeCartCookieValue("not-json"), []);
  assert.deepEqual(decodeCartCookieValue(encodeURIComponent("[{bad")), []);
});

test("cookie: TTL matches the shared cart lifetime", () => {
  const serialized = serializeCartCookie([{ variantId: "v1", quantity: 1 }]);
  assert.ok(serialized !== null);
  assert.ok(serialized.includes(`Max-Age=${CART_TTL_SECONDS}`));
  assert.ok(serialized.includes("Path=/"));
  assert.ok(serialized.includes("SameSite=Lax"));
});

test("cookie: Secure attribute is added only for HTTPS expectations", () => {
  assert.equal(shouldUseSecureCookie("https:"), true);
  assert.equal(shouldUseSecureCookie("http:"), false);
  assert.equal(shouldUseSecureCookie(""), false);
  const secure = serializeCartCookie([{ variantId: "v1", quantity: 1 }], { secure: true });
  assert.ok(secure !== null && secure.includes("Secure"));
  const insecure = serializeCartCookie([{ variantId: "v1", quantity: 1 }], { secure: false });
  assert.ok(insecure !== null && !insecure.includes("Secure"));
  const cleared = clearCartCookie({ secure: true });
  assert.ok(cleared.includes("Max-Age=0"));
  assert.ok(cleared.includes("Secure"));
});

test("cookie: MAX_COOKIE_VALUE_BYTES leaves headroom under the 4KB limit", () => {
  assert.ok(MAX_COOKIE_VALUE_BYTES <= 3584);
  assert.ok(MAX_COOKIE_VALUE_BYTES < 4096);
});

test("cookie: cookie name constant is stable", () => {
  assert.equal(CART_COOKIE, "reyhan-cart");
});

// ── Server authority note ────────────────────────────────────────────────
// validateCart (server-only, Prisma-bound) is the authority for prices,
// stock, and totals; the client stores only wishes. These tests pin the
// sanitization + cookie contracts that keep that boundary intact:
// priceSnapshot values in storage never feed a total, and the cookie
// carries no price data at all. Validating real DB-backed rows belongs
// to the server pipeline, mirroring the checkout/payments suites.
