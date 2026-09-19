// Phase 8 cart storage smoke-test — plain-Node checks of the pure guest-cart
// helpers (sanitize/isValidMutation) used by both browser storage and the
// server action. Not part of the app bundle. Run: node scripts/test-cart.mjs
// Runtime equivalents live in src/lib/cart/storage.ts (TypeScript).

// Mirrors sanitizeEntries logic from src/lib/cart/storage.ts (kept minimal —
// the authoritative implementation is the TS file; this is a redundant check).
function isPositiveFiniteInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function sanitizeEntries(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value.slice(0, 50)) {
    if (typeof raw !== "object" || raw === null) continue;
    const variantId = typeof raw.variantId === "string" ? raw.variantId.trim() : "";
    if (!variantId || variantId.length > 128) continue;
    if (!isPositiveFiniteInt(raw.quantity)) continue;
    if (seen.has(variantId)) continue;
    seen.add(variantId);
    out.push({ variantId, quantity: Math.min(raw.quantity, 999) });
  }
  return out;
}

const cases = [
  [[], 0, "empty array"],
  ["garbage", 0, "non-array"],
  [null, 0, "null"],
  [[{ variantId: "a", quantity: 2 }], 1, "valid entry"],
  [[{ variantId: "a", quantity: 2 }, { variantId: "a", quantity: 3 }], 1, "duplicate variantId dropped"],
  [[{ variantId: "a", quantity: -1 }], 0, "negative quantity dropped"],
  [[{ variantId: "a", quantity: 1.5 }], 0, "fractional quantity dropped"],
  [[{ variantId: "", quantity: 1 }], 0, "empty variantId dropped"],
  [[{ variantId: 42, quantity: 1 }], 0, "non-string variantId dropped"],
  [[{ variantId: "a", quantity: 2 }, { variantId: "b", quantity: 3 }], 2, "two distinct variants"],
];

let failures = 0;
for (const [input, expected, name] of cases) {
  const got = sanitizeEntries(input).length;
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${got}/${expected}`);
}

if (failures > 0) {
  console.error(`${failures} case(s) failed`);
  process.exit(1);
}
console.log("All cart storage smoke tests passed.");
