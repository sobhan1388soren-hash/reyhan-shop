// Phase 8 cart mutation-flow test — mirrors the pure logic of the guest cart
// (write/merge semantics used by use-cart.ts + storage.ts) against a fake
// localStorage. Run: node scripts/test-cart-flow.mjs
// The browser hook uses identical logic; this validates merge/clamp behavior.

class FakeLocalStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

class FakeWindow {
  constructor() {
    this.localStorage = new FakeLocalStorage();
    this.events = [];
  }
  dispatchEvent(e) { this.events.push(e.type); }
}

// — Mirrors of the hook's mutation logic (kept in sync manually) —
function addToCart(win, key, cart, variantId, quantity, priceSnapshot) {
  const current = read(win, key);
  const existing = current.find((e) => e.variantId === variantId);
  const snapshot = existing?.priceSnapshot ?? priceSnapshot;
  const next = existing
    ? current.map((e) => e.variantId === variantId ? { ...e, quantity: e.quantity + quantity, priceSnapshot: snapshot } : e)
    : [...current, { variantId, quantity, priceSnapshot: snapshot, addedAt: Date.now() }];
  write(win, key, next);
  return next;
}

function switchVariant(win, key, cart, fromId, toId) {
  const current = read(win, key);
  const from = current.find((e) => e.variantId === fromId);
  const to = current.find((e) => e.variantId === toId);
  if (!from) return current;
  let next;
  if (to) {
    next = current.filter((e) => e.variantId !== fromId)
      .map((e) => e.variantId === toId ? { ...e, quantity: e.quantity + from.quantity } : e);
  } else {
    next = current.map((e) => e.variantId === fromId ? { ...e, variantId: toId } : e);
  }
  write(win, key, next);
  return next;
}

function updateQuantity(win, key, variantId, quantity) {
  const next = read(win, key).map((e) => e.variantId === variantId ? { ...e, quantity } : e);
  write(win, key, next);
  return next;
}

function removeFromCart(win, key, variantId) {
  const next = read(win, key).filter((e) => e.variantId !== variantId);
  write(win, key, next);
  return next;
}

function read(win, key) {
  const raw = win.localStorage.getItem(key);
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return []; }
  return sanitize(parsed);
}

// Mirrors sanitizeEntries from src/lib/cart/storage.ts
function sanitize(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value.slice(0, 50)) {
    if (typeof raw !== "object" || raw === null) continue;
    const variantId = typeof raw.variantId === "string" ? raw.variantId.trim() : "";
    if (!variantId || variantId.length > 128) continue;
    if (!Number.isInteger(raw.quantity) || raw.quantity <= 0) continue;
    if (seen.has(variantId)) continue;
    seen.add(variantId);
    out.push({ variantId, quantity: Math.min(raw.quantity, 999) });
  }
  return out;
}

function write(win, key, entries) {
  if (entries.length === 0) win.localStorage.removeItem(key);
  else win.localStorage.setItem(key, JSON.stringify(entries));
  win.dispatchEvent({ type: "reyhan-cart-change" });
}

// — Test cases —
const KEY = "reyhan-cart:v2";
let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name} — ${JSON.stringify(detail)}`); }
}

const win = new FakeWindow();

// 1. add new item
let cart = addToCart(win, KEY, null, "v1", 2, 100000);
check("add new item", cart.length === 1 && cart[0].quantity === 2 && cart[0].priceSnapshot === 100000, cart);

// 2. add same item merges quantity
cart = addToCart(win, KEY, null, "v1", 1, 100000);
check("merge on re-add", cart.length === 1 && cart[0].quantity === 3, cart);

// 3. add second distinct item
cart = addToCart(win, KEY, null, "v2", 1, 50000);
check("two distinct items", cart.length === 2 && cart[1].variantId === "v2", cart);

// 4. update quantity
cart = updateQuantity(win, KEY, "v1", 5);
check("update quantity", cart[0].quantity === 5, cart);

// 5. switch to fresh variant keeps quantity + replaces id
cart = switchVariant(win, KEY, null, "v2", "v3");
check("switch to fresh variant", cart.length === 2 && cart[1].variantId === "v3" && cart[1].quantity === 1, cart);

// 6. switch to existing variant merges quantities
cart = switchVariant(win, KEY, null, "v1", "v3");
check("switch merges into existing", cart.length === 1 && cart[0].variantId === "v3" && cart[0].quantity === 6, cart);

// 7. remove item
cart = removeFromCart(win, KEY, "v3");
check("remove item", cart.length === 0 && win.localStorage.getItem(KEY) === null, cart);

// 8. persistence across "reload" — re-read raw storage
addToCart(win, KEY, null, "v9", 2, 1);
const reloaded = read(win, KEY);
check("persist after reload", reloaded.length === 1 && reloaded[0].variantId === "v9" && reloaded[0].quantity === 2, reloaded);

// 9. malformed storage is dropped, not crashing
win.localStorage.setItem(KEY, "{not json");
check("malformed json tolerated", read(win, KEY).length === 0);
win.localStorage.setItem(KEY, JSON.stringify([{ variantId: "x", quantity: -3 }, "junk", 7]));
check("hostile entries filtered", read(win, KEY).length === 0);

// 10. events dispatched
check("change event dispatched", win.events.includes("reyhan-cart-change"));

if (failures > 0) { console.error(`${failures} failed`); process.exit(1); }
console.log("All cart mutation-flow tests passed.");
