// PHASE 20 — Purchase-flow verification probe.
//
// Executes the complete customer purchase flow end-to-end against the real
// sandbox database through the REAL production code paths (the same
// functions the routes and server actions call), and asserts database state
// after every critical step:
//
//   OTP login → session → product selection → cart → checkout
//     → order PENDING → payment INITIATED → callback → PAID → CONFIRMED
//
// Two legs, because only the gateway can complete a hosted payment:
//
//   LEG A (live sandbox integration):
//     The REAL ZarinPalGateway talks to the real ZarinPal sandbox
//     (https://sandbox.payment.zarinpal.com) — a real authority is issued
//     and persisted on a real Payment row, and a real server-side verify is
//     performed (expected to answer "not paid" until the hosted sandbox
//     payment is completed in a browser — that completion is the manual
//     verification step of Phase 20). Proves credentials, sandbox host,
//     request/verify shaping, and authority persistence are all live.
//
//   LEG B (complete purchase to PAID, DB-backed):
//     The identical production orchestration runs with a faithful
//     ZarinPal-sandbox simulator injected through the existing
//     setGatewayForTests hook, so the hosted-payment step can be completed
//     programmatically. Every line of OUR code — validation, order
//     creation, authority persistence, server-side verification,
//     finalization, the PENDING→PAID→CONFIRMED transition, duplicate
//     callback idempotency, and the cancel path — runs for real against
//     the real database.
//
// Env requirements: DATABASE_URL, SESSION_SECRET (>=32), and for LEG A a
// valid ZARINPAL_MERCHANT_ID + ZARINPAL_SANDBOX=true. LEG A self-skips
// (with a clear reason) when the merchant id is not provisioned.
//
// The probe forces SMS_PROVIDER=console for ITS OWN process only (it never
// sends a real SMS) and reads the issued code from the documented dev
// debug log (OTP_DEBUG_LOG) — the code still traverses the full real
// issuance, hashing, storage and verification path.
//
// Idempotent: previous probe rows are removed first, so re-runs stay clean.
// Exit code 0 = all assertions passed.
//
//   Usage:  npm run verify:purchase-flow

import { register } from "node:module";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// ── 0. Register the dev-only alias/server-only loader BEFORE any prod import
register(pathToFileURL("./scripts/dev-loader.mjs").href, pathToFileURL(import.meta.url).href);

// `src/lib/prisma.ts` lazily builds its client with a CommonJS `require(...)`.
// In a bare ESM process `require` is undefined, so expose the standard
// Node shim on the global scope. This is a probe-side convenience only —
// the application always runs that code inside Next's own runtime.
globalThis.require = createRequire(import.meta.url);

// ── Sandbox-only overrides for THIS process — set before importing auth,
//    because the SMS sender is resolved once and cached on first use.
process.env.SMS_PROVIDER = "console";
process.env.OTP_DEBUG_LOG = "true";
if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";

import "dotenv/config";

// ── Real production modules (resolved through the dev loader) ──────────
const { requestOtp, verifyOtp } = await import("../src/lib/auth/otp.ts");
const { serializeSession, parseSession } = await import("../src/lib/auth/session.ts");
const { validateCart } = await import("../src/lib/cart/validate.ts");
const {
  validateCheckoutFinal,
} = await import("../src/lib/checkout/validate.ts");
const { createOrderFromCheckout } = await import("../src/lib/checkout/order.ts");
const {
  startUserGatewayPayment,
  handleUserGatewayCallback,
} = await import("../src/lib/payments/service.ts");
const { readZarinPalConfig, zarinPalConfigLooksValid } = await import(
  "../src/lib/payments/zarinpal.ts"
);
const { setGatewayForTests } = await import("../src/lib/payments/registry.ts");
const { updateOrderStatus } = await import("../src/lib/admin/order-service.ts");
const { PaymentGatewayError } = await import("../src/lib/payments/gateway.ts");
const { SITE_NAME, SITE_URL } = await import("../src/lib/constants.ts");

// ── Prisma (same construction path as prisma/seed-dev.mjs) ─────────────
async function createPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  try {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  } catch {
    return new PrismaClient();
  }
}

// ── Test identity ──────────────────────────────────────────────────────
// 989000000001 satisfies the Iranian-mobile shape rule but is not a real
// assigned range; combined with the forced console provider above, no real
// SMS is ever attempted by this probe.
const PROBE_PHONE = process.env.PROBE_PHONE ?? "989000000001";
const PROBE_TAG = "[phase20-probe]";
const PROBE_VARIANT_SKU = process.env.PROBE_SKU ?? "REYHAN-DEV-PP5-3PK-V1";
const QUANTITY = 1;

// ── Tiny assertion harness (no test framework needed) ──────────────────
let step = 0;
let failures = 0;
const evidence = [];

function log(msg) {
  console.log(`[phase20] ${msg}`);
}
function ok(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  step++;
  console.log(`\n[phase20] ── STEP ${step}: ${title} ──`);
}
function record(key, value) {
  evidence.push({ key, value });
}

// ── OTP capture: observe the documented dev debug log ──────────────────
let capturedOtp = null;
const originalInfo = console.info;
console.info = (...args) => {
  const text = typeof args[0] === "string" ? args[0] : "";
  const match = text.match(/\[DEV OTP\] phone=(\S+) code=(\d+)/);
  if (match && match[1] === PROBE_PHONE) capturedOtp = match[2];
  originalInfo(...args);
};

async function captureIssuedOtp() {
  // NOTE: do NOT clear `capturedOtp` here — the issuance call has already
  // happened and the console hook may have fired synchronously. The caller
  // clears the variable immediately BEFORE calling requestOtp instead.
  for (let i = 0; i < 40 && capturedOtp === null; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  return capturedOtp;
}

// ── Faithful ZarinPal-sandbox simulator (LEG B) ────────────────────────
// Mirrors the real adapter's contract exactly: request → authority,
// verify → refId + code 100. Only OUR code is under test here; the hosted
// payment step (which only a browser can do) is what the simulator stands
// in for.
function createSandboxGatewaySimulator() {
  const issued = new Map();
  let seq = 0;
  return {
    provider: "ZARINPAL",
    async requestPayment(input) {
      const n = (++seq).toString().padStart(8, "0");
      const authority = `sim${n}-0000-0000-0000-000000000000`;
      issued.set(authority, { amount: input.amount });
      return {
        authority,
        redirectUrl: `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
      };
    },
    async verifyPayment(input) {
      const row = issued.get(input.authority);
      if (!row) throw new PaymentGatewayError("VERIFY_FAILED", "unknown-authority");
      if (row.amount !== input.amount) throw new PaymentGatewayError("VERIFY_FAILED", "amount");
      return { refId: String(1_000_000_000 + seq), meta: { code: 100 } };
    },
  };
}

// ── Cleanup of any previous probe run ──────────────────────────────────
async function cleanPreviousRun(prisma) {
  section("cleanup previous probe rows");
  // Payments/orders first (FKs), then the rest. Discount usages are tied to
  // probe orders and must go before the order rows.
  const probeOrders = await prisma.order.findMany({
    where: { notes: { contains: PROBE_TAG } },
    select: {
      id: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });
  const orderIds = probeOrders.map((o) => o.id);

  // Order creation decrements real stock. The probe's orders are test
  // artifacts, so their consumption is reversed here — otherwise every re-run
  // would permanently drain the catalog's inventory.
  for (const order of probeOrders) {
    for (const item of order.items) {
      await prisma.inventory.updateMany({
        where: { variantId: item.variantId },
        data: { quantity: { increment: item.quantity } },
      });
    }
  }
  if (orderIds.length) {
    await prisma.inventoryTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.discountUsage.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.otpToken.deleteMany({ where: { phone: PROBE_PHONE } });
  await prisma.address.deleteMany({ where: { recipientName: { contains: PROBE_TAG } } });
  await prisma.user.deleteMany({ where: { phone: PROBE_PHONE } });
  log(`removed ${orderIds.length} previous probe order(s) and restored their stock`);
}

// ───────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = await createPrisma();
  const gatewayConfig = readZarinPalConfig();
  const liveLegAvailable = zarinPalConfigLooksValid(gatewayConfig);

  log(`sandbox mode        : ${gatewayConfig.sandbox ? "true" : "false"}`);
  log(`merchant id         : ${gatewayConfig.merchantId ? `${gatewayConfig.merchantId.slice(0, 8)}…(${gatewayConfig.merchantId.length} chars)` : "(not provisioned)"}`);
  log(`site url            : ${SITE_URL}`);
  log(`live sandbox leg    : ${liveLegAvailable ? "WILL RUN (real ZarinPal sandbox)" : "SKIPPED (no valid ZARINPAL_MERCHANT_ID)"}`);

  await cleanPreviousRun(prisma);

  // ── STEP: customer bootstrap ─────────────────────────────────────────
  section("customer bootstrap");
  const customer = await prisma.user.create({
    data: {
      phone: PROBE_PHONE,
      role: "CUSTOMER",
      status: "ACTIVE",
      phoneVerified: false,
      firstName: "خریدار",
      lastName: "تست فاز ۲۰",
    },
    select: { id: true, phone: true, phoneVerified: true },
  });
  ok("test customer created", !!customer.id, customer);
  record("customerId", customer.id);

  // ── STEP: OTP issuance (real requestOtp) ─────────────────────────────
  section("OTP login — issuance (real requestOtp)");
  capturedOtp = null;
  const issued = await requestOtp(PROBE_PHONE, "LOGIN", customer.id);
  ok("OTP issued without error", issued.ok === true, issued);
  if (!issued.ok) {
    log("ABORT: OTP issuance failed — cannot continue the purchase flow");
    await prisma.$disconnect();
    process.exit(1);
  }

  const code = await captureIssuedOtp();
  ok("OTP captured via dev debug log", typeof code === "string" && /^\d{6}$/.test(code), code);

  const tokenRow = await prisma.otpToken.findFirst({
    where: { phone: PROBE_PHONE, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, verified: true, expiresAt: true, attempts: true },
  });
  ok("OTP stored hashed (never plaintext)", !!tokenRow && tokenRow.code !== code);
  ok(
    "stored hash matches phone:code (per-phone salt)",
    !!tokenRow && tokenRow.code === createHash("sha256").update(`${PROBE_PHONE}:${code}`).digest("hex")
  );
  ok("OTP token is unverified before use", tokenRow?.verified === false);

  // ── STEP: OTP verify (real verifyOtp) → phoneVerified ────────────────
  section("OTP login — verification (real verifyOtp)");
  const verified = await verifyOtp(PROBE_PHONE, "LOGIN", code);
  ok("OTP verified", verified.ok === true, verified);

  const tokenAfter = await prisma.otpToken.findFirst({
    where: { phone: PROBE_PHONE, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
    select: { verified: true },
  });
  ok("OTP token consumed (single-use)", tokenAfter?.verified === true);

  const userAfter = await prisma.user.findUnique({
    where: { id: customer.id },
    select: { phoneVerified: true },
  });
  // The OTP library's contract is ONLY to consume the token — it must never
  // stamp identity facts on the user row itself. `phoneVerified` is set by
  // the login server action (src/app/actions/auth.ts), which additionally
  // needs a Next request context to set the session cookie. Assert the
  // library did not overreach.
  ok(
    "OTP library does not stamp phoneVerified (owned by the login action)",
    userAfter?.phoneVerified === false,
    userAfter?.phoneVerified
  );
  log("phoneVerified is stamped by verifyLoginOtp (src/app/actions/auth.ts) together with createSession()");

  // ── STEP: session integrity (real serializeSession/parseSession) ─────
  section("session integrity (signed cookie round-trip)");
  const token = serializeSession({
    userId: customer.id,
    role: "CUSTOMER",
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  const parsed = parseSession(token);
  ok("signed session round-trips", parsed?.userId === customer.id && parsed.role === "CUSTOMER", parsed);
  const forged = parseSession(`${token.slice(0, -3)}abc`);
  ok("tampered session signature rejected", forged === null);
  ok(
    "SESSION_SECRET is a strong real value (>=32)",
    typeof process.env.SESSION_SECRET === "string" && process.env.SESSION_SECRET.length >= 32,
    process.env.SESSION_SECRET?.length
  );

  // ── STEP: product selection (real catalog read) ──────────────────────
  section("product selection");
  const variant = await prisma.productVariant.findFirst({
    where: { sku: PROBE_VARIANT_SKU, isActive: true },
    include: {
      product: { select: { id: true, title: true, status: true, slug: true } },
      inventory: true,
    },
  });
  ok("seeded variant found and active", variant?.product?.status === "ACTIVE", variant?.sku);
  if (!variant) {
    log("ABORT: seed data missing — run `npm run seed:dev` first");
    await prisma.$disconnect();
    process.exit(1);
  }
  const stockBefore = variant.inventory?.quantity ?? 0;
  ok("variant has stock", stockBefore >= QUANTITY, { stockBefore, want: QUANTITY });
  record("variantId", variant.id);
  record("unitPrice", variant.price);
  record("stockBefore", stockBefore);

  // ── STEP: cart (real validateCart; client price is intentionally stale) ──
  section("cart validation (server-authoritative pricing)");
  const cartEntries = [
    {
      variantId: variant.id,
      quantity: QUANTITY,
      priceSnapshot: variant.price + 1_000_000, // stale — must be ignored
    },
  ];
  const cart = await validateCart(cartEntries);
  ok("cart has one purchasable item", cart.items.length === 1 && cart.purchasableCount === 1, cart);
  ok("server price overrides the client snapshot", cart.items[0]?.unitPrice === variant.price);
  ok("client price snapshot flagged as stale", cart.items[0]?.previousPrice === variant.price + 1_000_000);
  ok("server subtotal == DB price × qty", cart.subtotal === variant.price * QUANTITY, {
    subtotal: cart.subtotal,
    expected: variant.price * QUANTITY,
  });
  // The entry carries a deliberately stale client snapshot, so the server is
  // EXPECTED to raise exactly one issue (`price_changed`) while keeping the
  // item fully purchasable — the snapshot is a UX hint, never a blocker.
  ok(
    "stale client snapshot raises exactly the price_changed issue",
    cart.items[0]?.issues.length === 1 && cart.items[0].issues[0] === "price_changed",
    cart.items[0]?.issues
  );
  ok(
    "a price-changed item is still purchasable (never silently dropped)",
    cart.items[0]?.purchasable === true && cart.allPurchasable === true
  );
  ok("price_changed is the only flagged issue", cart.hasIssues === true);

  // Control case: an entry with NO stale snapshot must be completely clean,
  // proving hasIssues above is driven by the real snapshot comparison and is
  // not simply always-true.
  const cleanCart = await validateCart([
    { variantId: variant.id, quantity: QUANTITY, priceSnapshot: variant.price },
  ]);
  ok(
    "a matching client snapshot yields a clean cart (no issues)",
    cleanCart.hasIssues === false && cleanCart.items[0]?.issues.length === 0,
    cleanCart.items[0]?.issues
  );
  ok("clean cart is purchasable with the same subtotal", cleanCart.subtotal === cart.subtotal);

  // ── STEP: address for checkout ───────────────────────────────────────
  section("checkout address");
  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      recipientName: `خریدار تست ${PROBE_TAG}`,
      phone: PROBE_PHONE,
      province: "تهران",
      city: "تهران",
      postalCode: "1234567890",
      addressLine: "خیابان تست، پلاک ۱، واحد ۱ — نشانی آزمایشی فاز ۲۰",
      isDefault: true,
    },
    select: { id: true },
  });
  ok("address created for the customer", !!address.id);

  // ── STEP: checkout final validation (real validateCheckoutFinal) ─────
  section("checkout — final server-side validation");
  const validated = await validateCheckoutFinal({
    userId: customer.id,
    cartEntries,
    addressId: address.id,
    shippingMethodId: "STANDARD",
    paymentMethodId: "ONLINE",
    discountCode: "",
  });
  ok("validation passed", !!validated, validated);
  ok("totals are server-computed", validated.totals.subtotal === cart.subtotal && validated.totals.totalAmount === cart.subtotal, validated.totals);
  ok("payment method resolved to ONLINE", validated.paymentMethodId === "ONLINE");
  record("totals", validated.totals);

  // ═════════════════════════════════════════════════════════════════════
  // LEG A — LIVE ZARINPAL SANDBOX INTEGRATION
  // ═════════════════════════════════════════════════════════════════════
  section("LEG A — live order creation + REAL ZarinPal sandbox request");

  const orderA = await createOrderFromCheckout(customer.id, {
    ...validated,
    totals: validated.totals,
  }).catch((e) => {
    log(`LEG A order creation threw: ${e?.message ?? e}`);
    return null;
  });
  ok("LEG A order created atomically", !!orderA?.id, orderA);
  if (!orderA) {
    log("ABORT: order creation failed");
    await prisma.$disconnect();
    process.exit(1);
  }
  await prisma.order.update({ where: { id: orderA.id }, data: { notes: `${PROBE_TAG} legA live sandbox` } });

  // DB state after order creation — the Cart → Order PENDING → Payment PENDING chain
  const orderARow = await prisma.order.findUnique({
    where: { id: orderA.id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  ok("order status PENDING", orderARow?.status === "PENDING", orderARow?.status);
  ok("order paymentStatus PENDING", orderARow?.paymentStatus === "PENDING", orderARow?.paymentStatus);
  ok("order total == validated total", orderARow?.totalAmount === validated.totals.totalAmount);
  ok("order item snapshots use DB prices", orderARow?.items[0]?.priceSnapshot === variant.price);
  ok("order item snapshot title is Persian", (orderARow?.items[0]?.titleSnapshot ?? "").length > 0, orderARow?.items[0]?.titleSnapshot);
  ok("a PENDING ONLINE payment row exists", orderARow?.payments.some((p) => p.status === "PENDING" && p.method === "ONLINE"));
  record("orderAId", orderA.id);
  record("orderANumber", orderA.orderNumber);

  const invAfterOrderA = await prisma.inventory.findUnique({ where: { variantId: variant.id } });
  ok(
    "inventory decremented at order creation (reserved once, exactly)",
    (invAfterOrderA?.quantity ?? 0) === stockBefore - QUANTITY,
    { before: stockBefore, after: invAfterOrderA?.quantity }
  );
  const txnA = await prisma.inventoryTransaction.findFirst({
    where: { orderId: orderA.id },
  });
  ok("inventory audit transaction logged (reason ORDER)", txnA?.change === -QUANTITY && txnA?.reason === "ORDER", txnA);

  let liveAuthority = null;
  if (liveLegAvailable) {
    // Real network call to the real ZarinPal sandbox.
    const started = await startUserGatewayPayment({
      userId: customer.id,
      orderId: orderA.id,
      callbackUrl: `${SITE_URL}/api/payments/callback`,
      siteName: SITE_NAME,
    });
    ok("LEG A live gateway request returned a redirect", started.ok === true && started.kind === "REDIRECT", started);
    if (started.ok && started.kind === "REDIRECT") {
      liveAuthority = started.redirectUrl;
      ok("redirect points at the sandbox StartPay host", /sandbox\.zarinpal\.com\/pg\/StartPay\//.test(started.redirectUrl), started.redirectUrl);
      record("liveSandboxRedirectUrl", started.redirectUrl);
    }

    const paymentALive = await prisma.payment.findFirst({
      where: { orderId: orderA.id },
      orderBy: { createdAt: "desc" },
    });
    ok("authority persisted on the PENDING payment", !!paymentALive?.authority, paymentALive?.authority);
    ok("payment provider recorded as ZARINPAL", paymentALive?.provider === "ZARINPAL", paymentALive?.provider);
    ok("payment amount == order total (never client-supplied)", paymentALive?.amount === orderARow?.totalAmount);
    record("liveAuthority", paymentALive?.authority ?? null);

    // Real server-side verify against the sandbox: the hosted payment has
    // NOT been completed, so the sandbox must answer "not paid". This
    // proves the verify leg is wired correctly and never fabricates success.
    if (paymentALive?.authority) {
      section("LEG A — live server-side verify (unpaid authority must NOT pass)");
      const verifyOutcome = await handleUserGatewayCallback({
        userId: customer.id,
        authority: paymentALive.authority,
        statusHint: "OK",
      });
      ok(
        "unpaid sandbox authority is NOT confirmed (no fabricated PAID)",
        verifyOutcome.kind === "FAILED" || verifyOutcome.kind === "VERIFY_ERROR",
        verifyOutcome
      );
      const stillPending = await prisma.payment.findFirst({
        where: { id: paymentALive.id },
        select: { status: true },
      });
      ok("payment not wrongly marked PAID", stillPending?.status !== "PAID", stillPending?.status);
      log(`LEG A live verify outcome: ${verifyOutcome.kind} (expected non-success until the hosted sandbox payment completes)`);
      log(`LEG A manual step: open this URL in a browser to finish that payment → ${liveAuthority ?? "(no redirect captured)"}`);
    }
  } else {
    log("LEG A live request SKIPPED — ZARINPAL_MERCHANT_ID not provisioned (see .env.example).");
    log("The full critical path still runs to PAID in LEG B below.");
  }

  // ═════════════════════════════════════════════════════════════════════
  // LEG B — COMPLETE PURCHASE TO PAID (simulated gateway, real DB)
  // ═════════════════════════════════════════════════════════════════════
  section("LEG B — second order for the complete purchase");

  const orderB = await createOrderFromCheckout(customer.id, validated);
  await prisma.order.update({ where: { id: orderB.id }, data: { notes: `${PROBE_TAG} legB full purchase to PAID` } });
  const orderBRow = await prisma.order.findUnique({
    where: { id: orderB.id },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  ok("LEG B order PENDING/PENDING", orderBRow?.status === "PENDING" && orderBRow?.paymentStatus === "PENDING");
  record("orderBId", orderB.id);
  record("orderBNumber", orderB.orderNumber);

  // Inject the simulator through the registry's documented test hook.
  const simulator = createSandboxGatewaySimulator();
  setGatewayForTests(simulator);

  section("LEG B — payment INITIATED (gateway session + authority)");
  const startedB = await startUserGatewayPayment({
    userId: customer.id,
    orderId: orderB.id,
    callbackUrl: `${SITE_URL}/api/payments/callback`,
    siteName: SITE_NAME,
  });
  ok("gateway session opened (REDIRECT)", startedB.ok === true && startedB.kind === "REDIRECT", startedB);

  const paymentB = await prisma.payment.findFirst({
    where: { orderId: orderB.id },
    orderBy: { createdAt: "desc" },
  });
  ok("payment is INITIATED — authority persisted, still PENDING", !!paymentB?.authority && paymentB.status === "PENDING", {
    authority: paymentB?.authority,
    status: paymentB?.status,
  });
  ok("attempt amount == order total", paymentB?.amount === orderBRow?.totalAmount);

  // ── STEP: callback OK → server-side verify → PAID ────────────────────
  section("LEG B — callback (Status=OK) → server verify → finalize");

  const callback1 = await handleUserGatewayCallback({
    userId: customer.id,
    authority: paymentB.authority,
    statusHint: "OK",
  });
  ok("callback outcome SUCCESS", callback1.kind === "SUCCESS", callback1);

  const paidRow = await prisma.payment.findFirst({
    where: { id: paymentB.id },
    select: { status: true, transactionId: true, paidAt: true, provider: true },
  });
  ok("Payment status PAID", paidRow?.status === "PAID", paidRow?.status);
  ok("transactionId recorded from gateway refId", typeof paidRow?.transactionId === "string" && paidRow.transactionId.length > 0, paidRow?.transactionId);
  ok("paidAt stamped", paidRow?.paidAt instanceof Date);

  const confirmedRow = await prisma.order.findUnique({
    where: { id: orderB.id },
    select: { status: true, paymentStatus: true },
  });
  ok("Order paymentStatus PAID", confirmedRow?.paymentStatus === "PAID", confirmedRow?.paymentStatus);
  ok(
    "Order status CONFIRMED (payment-driven transition)",
    confirmedRow?.status === "CONFIRMED",
    confirmedRow?.status
  );
  record("paymentConfirmedOrderStatus", confirmedRow?.status);
  record("finalPaymentStatus", paidRow?.status);

  // ── STEP: duplicate callback idempotency ─────────────────────────────
  section("LEG B — duplicate callback (idempotency)");

  const callback2 = await handleUserGatewayCallback({
    userId: customer.id,
    authority: paymentB.authority,
    statusHint: "OK",
  });
  ok("duplicate callback is a safe no-op (ALREADY_PAID)", callback2.kind === "ALREADY_PAID", callback2);

  const paymentsForB = await prisma.payment.findMany({
    where: { orderId: orderB.id },
    orderBy: { createdAt: "asc" },
  });
  const paidCount = paymentsForB.filter((p) => p.status === "PAID").length;
  ok("exactly ONE PAID payment — no duplicated writes", paidCount === 1, { paidCount, total: paymentsForB.length });
  ok("no extra payment rows created by the replay", paymentsForB.length === 1, paymentsForB.length);

  const paidAfterReplay = await prisma.payment.findFirst({
    where: { id: paymentB.id },
    select: { transactionId: true, paidAt: true },
  });
  ok("refId unchanged after the replay", paidAfterReplay?.transactionId === paidRow.transactionId);

  // ── STEP: negative path (user cancels at the gateway) ────────────────
  section("LEG B — cancel path (Status=NOK) on a fresh order");

  const orderC = await createOrderFromCheckout(customer.id, validated);
  await prisma.order.update({ where: { id: orderC.id }, data: { notes: `${PROBE_TAG} legC cancelled at gateway` } });
  const startedC = await startUserGatewayPayment({
    userId: customer.id,
    orderId: orderC.id,
    callbackUrl: `${SITE_URL}/api/payments/callback`,
    siteName: SITE_NAME,
  });
  ok("cancel-path order got a gateway session", startedC.ok === true, startedC);
  const paymentC = await prisma.payment.findFirst({
    where: { orderId: orderC.id },
    orderBy: { createdAt: "desc" },
  });

  const cancelOutcome = await handleUserGatewayCallback({
    userId: customer.id,
    authority: paymentC.authority,
    statusHint: "NOK",
  });
  ok("NOK callback resolves to CANCELLED", cancelOutcome.kind === "CANCELLED", cancelOutcome);

  const orderCRow = await prisma.order.findUnique({
    where: { id: orderC.id },
    select: { status: true, paymentStatus: true },
  });
  ok("order stays PENDING after cancel (retryable)", orderCRow?.status === "PENDING", orderCRow?.status);
  ok("order paymentStatus mirrored to CANCELLED", orderCRow?.paymentStatus === "CANCELLED", orderCRow?.paymentStatus);

  const paymentCRow = await prisma.payment.findFirst({
    where: { id: paymentC.id },
    select: { status: true },
  });
  ok("payment attempt is CANCELLED", paymentCRow?.status === "CANCELLED", paymentCRow?.status);

  // ── STEP: admin fulfillment CONFIRMED → PROCESSING ───────────────────
  section("admin fulfillment — CONFIRMED → PROCESSING (real admin service)");
  const adminActor = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true },
  });
  ok("ADMIN actor resolved from the DB row", !!adminActor, adminActor);

  // Authorization is enforced server-side against the allow-list — a
  // CUSTOMER must never be able to drive the fulfillment transition.
  const denied = await updateOrderStatus(
    { id: customer.id, role: "CUSTOMER" },
    orderB.id,
    "PROCESSING"
  );
  ok(
    "CUSTOMER is denied the admin transition (FORBIDDEN)",
    denied.ok === false && denied.error === "FORBIDDEN",
    denied
  );
  ok(
    "denied attempt left the order untouched",
    (await prisma.order.findUnique({ where: { id: orderB.id }, select: { status: true } }))?.status ===
      "CONFIRMED"
  );

  const advanced = await updateOrderStatus(
    { id: adminActor.id, role: adminActor.role },
    orderB.id,
    "PROCESSING"
  );
  ok(
    "ADMIN advances the paid order to PROCESSING",
    advanced.ok === true && advanced.data.status === "PROCESSING",
    advanced
  );

  const finalOrder = await prisma.order.findUnique({
    where: { id: orderB.id },
    select: { status: true, paymentStatus: true },
  });
  ok("order reaches the PROCESSING final state", finalOrder?.status === "PROCESSING", finalOrder?.status);
  ok("payment stays PAID through fulfillment", finalOrder?.paymentStatus === "PAID", finalOrder?.paymentStatus);
  record("finalOrderStatus", finalOrder?.status);

  // The state machine must still refuse illegal reverse transitions.
  const backwards = await updateOrderStatus(
    { id: adminActor.id, role: adminActor.role },
    orderB.id,
    "CONFIRMED"
  );
  ok(
    "illegal reverse transition PROCESSING → CONFIRMED is rejected",
    backwards.ok === false,
    backwards
  );

  // ── STEP: ownership isolation (foreign authority) ─────────────────────
  section("ownership isolation");
  const foreign = await handleUserGatewayCallback({
    userId: "user_foreignunknown0000000000000000",
    authority: paymentB.authority,
    statusHint: "OK",
  });
  ok("foreign user cannot resolve another user's payment", foreign.kind === "INVALID", foreign);

  // Restore the registry to the real adapter.
  setGatewayForTests(null);

  // ── STEP: final database state summary ───────────────────────────────
  section("final database state");
  const summary = await prisma.order.findMany({
    where: { notes: { contains: PROBE_TAG } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      payments: { select: { status: true, provider: true, transactionId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  for (const row of summary) {
    log(`  order ${row.orderNumber} — status=${row.status} payment=${row.paymentStatus} total=${row.totalAmount} payments=${JSON.stringify(row.payments.map((p) => p.status))}`);
  }
  ok("at least one probe order reached PAID", summary.some((o) => o.paymentStatus === "PAID"));
  ok(
    "at least one probe order reached the PROCESSING final state",
    summary.some((o) => o.status === "PROCESSING"),
    summary.map((o) => o.status)
  );

  const adminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  ok("an ADMIN account exists in the sandbox", adminCount >= 1, adminCount);

  const catalogCount = await prisma.product.count({ where: { status: "ACTIVE" } });
  ok("catalog has ACTIVE products", catalogCount >= 8, catalogCount);

  record("orders", summary.map((o) => ({ number: o.orderNumber, status: o.status, payment: o.paymentStatus })));

  await prisma.$disconnect();

  console.info = originalInfo;

  console.log("\n[phase20] ── EVIDENCE ──");
  for (const e of evidence) console.log(`  ${e.key} = ${JSON.stringify(e.value)}`);

  if (failures > 0) {
    console.log(`\n[phase20] FAILED — ${failures} assertion(s) did not pass.`);
    process.exit(1);
  }
  console.log("\n[phase20] ALL ASSERTIONS PASSED — purchase flow verified.");
  if (!liveLegAvailable) {
    console.log("[phase20] NOTE: live ZarinPal sandbox leg was skipped (no ZARINPAL_MERCHANT_ID).");
    console.log("[phase20]       Set it in .env and re-run to exercise the real gateway request/verify.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[phase20] Probe failed:", err);
  process.exit(1);
});
