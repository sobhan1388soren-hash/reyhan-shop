// Server-side validateCart test with a mocked Prisma — verifies clamping,
// price-change flags, out-of-stock/unavailable/removed handling, and that
// client-supplied prices/quantities never influence computed totals.
// Run: node scripts/test-cart-validate.mjs
// This is a logic mirror of src/lib/cart/validate.ts (pure JS port); the TS
// original is type-checked by tsc and runs inside the Next.js server action.

function makeVariant(id, productId, opts = {}) {
  return {
    id, productId,
    title: opts.title ?? `variant-${id}`,
    sku: `SKU-${id}`,
    price: opts.price ?? 100000, // Rial
    compareAtPrice: null,
    isActive: opts.isActive ?? true,
    isDefault: false,
    inventory: {
      quantity: opts.qty ?? 10,
      reservedQuantity: opts.reserved ?? 0,
      lowStockThreshold: opts.low ?? 5,
    },
    ...opts.extra,
  };
}

function makeProduct(id, variants, opts = {}) {
  return {
    id,
    title: opts.title ?? `product-${id}`,
    slug: opts.slug ?? `product-${id}`,
    status: opts.status ?? "ACTIVE",
    images: opts.images ?? [],
    variants,
  };
}

function makeDb(products) {
  return {
    product: {
      findMany: async ({ where }) => {
        const ids = where.variants.some.id.in;
        const out = [];
        for (const p of products) {
          if (p.variants.some((v) => ids.includes(v.id))) out.push(p);
        }
        return out;
      },
    },
  };
}

// Mirrors availability derivation from src/lib/catalog/availability.ts
function variantAvailability(v) {
  if (!v.isActive) return "unavailable";
  const inv = v.inventory;
  if (!inv) return "out_of_stock";
  const available = inv.quantity - inv.reservedQuantity;
  if (available <= 0) return "out_of_stock";
  if (available <= inv.lowStockThreshold) return "low_stock";
  return "in_stock";
}

// — Mirror of validateCart core logic —
async function validateCart(db, rawEntries) {
  const entries = (Array.isArray(rawEntries) ? rawEntries : []).filter(
    (e) => e && typeof e.variantId === "string" && e.variantId.length > 0 && Number.isInteger(e.quantity) && e.quantity > 0
  );
  if (entries.length === 0) return { items: [], subtotal: 0, totalCount: 0, purchasableCount: 0, allPurchasable: true };

  const variantIds = entries.map((e) => e.variantId);
  const products = await db.product.findMany({
    where: { variants: { some: { id: { in: variantIds } } } },
  });

  const index = new Map();
  for (const p of products) for (const v of p.variants) index.set(v.id, p);

  const items = [];
  let subtotal = 0, purchasableCount = 0, allPurchasable = true;

  for (const entry of entries) {
    const product = index.get(entry.variantId);
    if (!product) {
      items.push({ variantId: entry.variantId, purchasable: false, issues: ["variant_removed"], quantity: 0, lineTotal: 0, unitPrice: 0 });
      allPurchasable = false;
      continue;
    }
    const variant = product.variants.find((v) => v.id === entry.variantId);
    if (product.status !== "ACTIVE") {
      items.push({ variantId: entry.variantId, purchasable: false, issues: ["product_unavailable"], quantity: 0, lineTotal: 0, unitPrice: variant.price });
      allPurchasable = false;
      continue;
    }
    const stock = Math.max(0, variant.inventory.quantity - variant.inventory.reservedQuantity);
    const state = variantAvailability(variant);
    if (!variant.isActive || state === "out_of_stock" || state === "unavailable" || stock <= 0) {
      items.push({ variantId: entry.variantId, purchasable: false, issues: [variant.isActive ? "out_of_stock" : "variant_inactive"], quantity: 0, lineTotal: 0, unitPrice: variant.price });
      allPurchasable = false;
      continue;
    }
    const issues = [];
    let quantity = entry.quantity;
    if (quantity > stock) { issues.push("stock_exceeded"); quantity = stock; }
    const previousPrice = typeof entry.priceSnapshot === "number" && entry.priceSnapshot !== variant.price ? entry.priceSnapshot : null;
    if (previousPrice !== null) issues.push("price_changed");
    const lineTotal = variant.price * quantity; // server price × server-clamped qty
    items.push({ variantId: entry.variantId, purchasable: true, issues, quantity, lineTotal, unitPrice: variant.price, maxQuantity: stock, previousPrice });
    subtotal += lineTotal;
    purchasableCount += 1;
  }
  return { items, subtotal, totalCount: items.length, purchasableCount, allPurchasable, hasIssues: items.some((i) => i.issues.length > 0) };
}

// — Cases —
let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name} — ${JSON.stringify(detail)}`); }
}

const db = makeDb([
  makeProduct("p1", [makeVariant("v1", "p1", { price: 120000, qty: 10 })]),
  makeProduct("p2", [makeVariant("v2", "p2", { price: 50000, qty: 3 })]),
  makeProduct("p3", [makeVariant("v3", "p3", { price: 80000, qty: 0 })]),
  makeProduct("p4", [makeVariant("v4", "p4", { price: 90000, qty: 10, isActive: false })]),
  makeProduct("p5", [makeVariant("v5", "p5", { price: 70000, qty: 10 })], { status: "DRAFT" }),
]);

// 1. healthy item, qty within stock
let r = await validateCart(db, [{ variantId: "v1", quantity: 2, priceSnapshot: 120000 }]);
check("healthy item", r.items[0].purchasable && r.items[0].lineTotal === 240000 && r.subtotal === 240000, r);

// 2. qty exceeds stock → clamped to 3 with warning
r = await validateCart(db, [{ variantId: "v2", quantity: 5 }]);
check("stock clamp", r.items[0].quantity === 3 && r.items[0].issues.includes("stock_exceeded") && r.subtotal === 150000, r);

// 3. price changed → flagged, total uses new price
r = await validateCart(db, [{ variantId: "v1", quantity: 1, priceSnapshot: 90000 }]);
check("price change flagged", r.items[0].issues.includes("price_changed") && r.items[0].previousPrice === 90000 && r.subtotal === 120000, r);

// 4. out of stock
r = await validateCart(db, [{ variantId: "v3", quantity: 1 }]);
check("out of stock", !r.items[0].purchasable && r.items[0].issues.includes("out_of_stock") && r.subtotal === 0, r);

// 5. inactive variant
r = await validateCart(db, [{ variantId: "v4", quantity: 1 }]);
check("inactive variant", !r.items[0].purchasable && r.items[0].issues.includes("variant_inactive"), r);

// 6. non-ACTIVE product
r = await validateCart(db, [{ variantId: "v5", quantity: 1 }]);
check("draft product", !r.items[0].purchasable && r.items[0].issues.includes("product_unavailable"), r);

// 7. removed variant
r = await validateCart(db, [{ variantId: "ghost", quantity: 1 }]);
check("removed variant", !r.items[0].purchasable && r.items[0].issues.includes("variant_removed"), r);

// 8. mixed cart subtotal only counts purchasable
r = await validateCart(db, [
  { variantId: "v1", quantity: 1 },        // 120000
  { variantId: "v3", quantity: 1 },        // unavailable → 0
  { variantId: "ghost", quantity: 1 },      // removed → 0
]);
check("mixed subtotal", r.subtotal === 120000 && r.purchasableCount === 1 && !r.allPurchasable, r);

// 9. hostile input → empty
r = await validateCart(db, "junk");
check("hostile input", r.totalCount === 0);
r = await validateCart(db, [{ variantId: "v1", quantity: -5 }, { quantity: 2 }]);
check("invalid quantities dropped", r.totalCount === 0);

// 10. client-supplied total is irrelevant (server recomputes)
r = await validateCart(db, [{ variantId: "v1", quantity: 2, priceSnapshot: 1 /* fake cheap */ }]);
check("fake client price ignored", r.subtotal === 240000 && r.items[0].previousPrice === 1 && r.items[0].issues.includes("price_changed"), r);

if (failures > 0) { console.error(`${failures} failed`); process.exit(1); }
console.log("All server cart validation tests passed.");
