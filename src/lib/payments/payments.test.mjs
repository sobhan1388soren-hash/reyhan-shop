// Unit tests — payment lifecycle state machines, finalization engine,
// amount guards, the live ZarinPal adapter (mocked transport), and the
// Phase 10-B gateway flow orchestration. Pure logic only, DB-free: the
// engine and flow run against in-memory store fakes that mirror the
// Prisma adapter's transactional guards; the adapter runs against a
// fake fetch. NO live gateway call is ever made here.
//
// Run: npm run test:payments   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

// NOTE: .mjs file — pure JS, mirroring checkout.test.mjs. The .ts modules
// under test are imported with explicit extensions (Node strips their types).

import {
  canTransitionPaymentStatus,
  canTransitionOrderStatus,
  isTerminalPaymentStatus,
  isPaymentRetryable,
  isPaymentStale,
  ORDER_EFFECT_BY_PAYMENT_STATUS,
  PAYMENT_STALE_AFTER_MS,
} from "./status.ts";
import {
  isValidServerAmount,
  assertServerAmount,
  amountsMatch,
  PaymentAmountError,
  MAX_PAYMENT_AMOUNT_RIAL,
} from "./amount.ts";
import {
  paymentRejectMessage,
  PAYMENT_REJECT_MESSAGES,
} from "./errors.ts";
import {
  ZarinPalGateway,
  zarinPalConfigLooksValid,
  readZarinPalConfig,
  ZARINPAL_PROVIDER_ID,
  zarinPalTransportError,
  zarinPalParseCallback,
  ZARINPAL_PAY_ENDPOINT,
  ZARINPAL_SANDBOX_PAY_ENDPOINT,
} from "./zarinpal.ts";
import { getPaymentGateway, setGatewayForTests } from "./registry.ts";
import {
  finalizePayment,
  PaymentStateConflictError,
  isValidGatewayRef,
} from "./engine.ts";
import { startGatewayPayment, handleGatewayCallback } from "./flow.ts";
import {
  GATEWAY_UX_COPY,
  callbackOutcomeToUx,
  startOutcomeToUx,
  rejectReasonToUx,
} from "./ux.ts";
import { PaymentGatewayError } from "./gateway.ts";

// ── Shared fixtures ────────────────────────────────────────────────────

const USER_A = "user_aaaaaaaaaaaaaaaaaaaa";
const USER_B = "user_bbbbbbbbbbbbbbbbbb";
const ORDER_ID = "order_aaaaaaaaaaaaaaaaaa";
const PAYMENT_ID = "paym_aaaaaaaaaaaaaaaaaaa";
const TXN_REF = "A0000000000000000000000000000000";
const TXN_REF_2 = "B0000000000000000000000000000000";
const AUTHORITY = "a0000000-0000-0000-0000-000000000001";
const AUTHORITY_2 = "a0000000-0000-0000-0000-000000000002";
const AMOUNT = 1_250_000;
const CALLBACK_URL = "https://shop.test/api/payments/callback";

const VALID_CONFIG = {
  merchantId: "12345678-1234-1234-1234-123456789012",
  sandbox: false,
};
const VALID_CONFIG_SANDBOX = { ...VALID_CONFIG, sandbox: true };

function makeView(overrides = {}) {
  return {
    payment: {
      id: PAYMENT_ID,
      orderId: ORDER_ID,
      amount: overrides.paymentAmount ?? AMOUNT,
      method: "ONLINE",
      provider: "ZARINPAL",
      status: overrides.paymentStatus ?? "PENDING",
      transactionId: overrides.transactionId ?? null,
      createdAt: new Date(Date.now() - 60_000),
    },
    order: {
      id: ORDER_ID,
      userId: USER_A,
      status: overrides.orderStatus ?? "PENDING",
      paymentStatus: overrides.orderPaymentStatus ?? "PENDING",
      totalAmount: overrides.orderTotal ?? AMOUNT,
    },
  };
}

/**
 * In-memory fake mirroring the Prisma adapter semantics:
 *  - ownership join (payment via the user's order)
 *  - conditional transitions (PENDING-guarded, like updateMany where)
 *  - paired order write guarded on PENDING/PENDING (throws → rollback)
 *  - GatewayFlowStore extras: authority lookup + guarded persistence
 */
function makeFakeStore(initial) {
  let view = structuredClone(initial);
  const log = [];
  // Aliased on purpose: mutating store.view().payment (as the race test
  // does) must be visible to the guarded writes, mirroring one DB row.
  const paymentList = [view.payment];
  const orderMeta = {
    id: ORDER_ID,
    userId: view.order.userId,
    orderNumber: "RY-1404-000001",
    status: view.order.status,
    paymentStatus: view.order.paymentStatus,
    totalAmount: view.order.totalAmount,
    payments: paymentList,
  };
  let failPairedOrderWrite = false;
  let nextPaymentId = 1;

  return {
    log,
    view: () => view,
    orderMeta: () => orderMeta,
    payments: () => paymentList,
    setFailPairedOrderWrite: (v) => {
      failPairedOrderWrite = v;
    },
    async findPaymentWithOrderForUser(paymentId, userId) {
      const p = paymentList.find((x) => x.id === paymentId);
      if (!p) return null;
      if (userId !== view.order.userId) return null;
      return structuredClone({
        payment: {
          ...p,
          orderId: ORDER_ID,
          method: "ONLINE",
          provider: p.provider ?? "ZARINPAL",
        },
        order: { ...view.order },
      });
    },
    async findOrderWithPaymentsForUser(orderId, userId) {
      if (orderId !== ORDER_ID || userId !== view.order.userId) return null;
      return structuredClone(orderMeta);
    },
    async findPaymentByAuthorityForUser(authority, userId) {
      const p = paymentList.find((x) => x.authority === authority);
      if (!p || userId !== view.order.userId) return null;
      return structuredClone({
        payment: { ...p, orderId: ORDER_ID, method: "ONLINE" },
        order: { ...view.order },
      });
    },
    async persistAuthorityOnPendingPayment(paymentId, provider, authority) {
      const p = paymentList.find((x) => x.id === paymentId);
      if (!p || p.status !== "PENDING") return false;
      p.authority = authority;
      p.provider = provider;
      log.push({ op: "persist-authority", paymentId, authority });
      return true;
    },
    async createPaymentAttempt(orderId, amount, provider) {
      if (orderId !== ORDER_ID) return null;
      if (
        orderMeta.status !== "PENDING" ||
        !["PENDING", "FAILED", "CANCELLED"].includes(orderMeta.paymentStatus)
      ) {
        return null;
      }
      if (orderMeta.totalAmount !== amount) return null;
      const p = {
        id: `paym_new_${nextPaymentId++}`.padEnd(20, "0"),
        amount,
        provider,
        status: "PENDING",
        authority: null,
        createdAt: new Date(),
      };
      paymentList.push(p);
      log.push({ op: "create-attempt", paymentId: p.id });
      return { id: p.id };
    },
    async applyPaymentSuccess(input) {
      const p = paymentList.find((x) => x.id === input.paymentId);
      if (!p || p.status !== "PENDING") return "PAYMENT_ALREADY_PAID";
      if (failPairedOrderWrite) {
        throw new PaymentStateConflictError("order-not-pending");
      }
      if (view.order.status !== "PENDING" || view.order.paymentStatus !== "PENDING") {
        throw new PaymentStateConflictError("order-not-pending");
      }
      p.status = "PAID";
      p.transactionId = input.transactionId;
      orderMeta.status = "CONFIRMED";
      orderMeta.paymentStatus = "PAID";
      view.order.status = "CONFIRMED";
      view.order.paymentStatus = "PAID";
      log.push({ op: "success", paymentId: input.paymentId });
      return "APPLIED";
    },
    async applyPaymentFailure(input) {
      const p = paymentList.find((x) => x.id === input.paymentId);
      if (!p || p.status !== "PENDING") return "ALREADY_RESOLVED";
      if (failPairedOrderWrite) {
        throw new PaymentStateConflictError("order-not-pending");
      }
      if (view.order.status !== "PENDING" || view.order.paymentStatus !== "PENDING") {
        throw new PaymentStateConflictError("order-not-pending");
      }
      p.status = input.to;
      orderMeta.paymentStatus = input.to;
      view.order.paymentStatus = input.to; // order.status stays PENDING
      log.push({ op: "failure", paymentId: input.paymentId, to: input.to });
      return "APPLIED";
    },
  };
}

const SUCCESS_INTENT = {
  kind: "SUCCESS",
  transactionId: TXN_REF,
  meta: { code: 100 },
};
const FAIL_INTENT = { kind: "FAILURE", to: "FAILED" };
const CANCEL_INTENT = { kind: "FAILURE", to: "CANCELLED" };

// ── Fake gateway (mock provider for flow tests — never a live call) ─────

function makeFakeGateway(overrides = {}) {
  return {
    provider: "ZARINPAL",
    calls: [],
    async requestPayment(input) {
      this.calls.push({ op: "request", input });
      if (overrides.requestError) throw overrides.requestError;
      return {
        authority: overrides.authority ?? AUTHORITY,
        redirectUrl: `https://pay.test/${overrides.authority ?? AUTHORITY}`,
      };
    },
    async verifyPayment(input) {
      this.calls.push({ op: "verify", input });
      if (overrides.verifyError) throw overrides.verifyError;
      if (overrides.verifyRefusal) {
        throw new PaymentGatewayError("VERIFY_FAILED", "not-verified");
      }
      return { refId: overrides.refId ?? TXN_REF, meta: { code: 100 } };
    },
  };
}

// ── Fake fetch for the live ZarinPal adapter (HTTP-level mocks) ────────

function zarinResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeFakeFetch(handler) {
  return async (url, init) => handler(url, init);
}

const START_INPUT = {
  userId: USER_A,
  orderId: ORDER_ID,
  callbackUrl: CALLBACK_URL,
  siteName: "ریحان",
};

// ── Payment status state machine ───────────────────────────────────────

test("payment status: only PENDING may resolve; terminal states are frozen", () => {
  assert.ok(canTransitionPaymentStatus("PENDING", "PAID"));
  assert.ok(canTransitionPaymentStatus("PENDING", "FAILED"));
  assert.ok(canTransitionPaymentStatus("PENDING", "CANCELLED"));
  for (const from of ["PAID", "FAILED", "CANCELLED", "REFUNDED"]) {
    for (const to of ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]) {
      assert.equal(
        canTransitionPaymentStatus(from, to),
        false,
        `${from}→${to} must be forbidden`
      );
    }
  }
});

test("payment status: terminal set matches the enum semantics", () => {
  for (const s of ["PAID", "FAILED", "CANCELLED", "REFUNDED"]) {
    assert.ok(isTerminalPaymentStatus(s));
  }
  assert.equal(isTerminalPaymentStatus("PENDING"), false);
});

test("order status: payment success maps PENDING→CONFIRMED; failures leave the order untouched", () => {
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.PAID.orderStatus, "CONFIRMED");
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.PAID.orderPaymentStatus, "PAID");
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.FAILED.orderStatus, null);
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.FAILED.orderPaymentStatus, "FAILED");
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.CANCELLED.orderStatus, null);
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.CANCELLED.orderPaymentStatus, "CANCELLED");
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.PENDING.orderStatus, null);
  assert.equal(ORDER_EFFECT_BY_PAYMENT_STATUS.PENDING.orderPaymentStatus, null);
});

test("order status: transitions exclude fulfillment chains from payment reach", () => {
  assert.ok(canTransitionOrderStatus("PENDING", "CONFIRMED"));
  assert.ok(canTransitionOrderStatus("PENDING", "CANCELLED"));
  assert.equal(canTransitionOrderStatus("PENDING", "PROCESSING"), false);
  assert.equal(canTransitionOrderStatus("PENDING", "SHIPPED"), false);
  assert.equal(canTransitionOrderStatus("PENDING", "DELIVERED"), false);
  assert.equal(canTransitionOrderStatus("PENDING", "RETURNED"), false);
  assert.equal(canTransitionOrderStatus("CANCELLED", "PENDING"), false);
  assert.equal(canTransitionOrderStatus("CANCELLED", "CONFIRMED"), false);
});

test("retryable: PENDING order with no paid payment can retry; others cannot", () => {
  assert.ok(isPaymentRetryable({ status: "PENDING", paymentStatus: "PENDING" }));
  assert.ok(isPaymentRetryable({ status: "PENDING", paymentStatus: "FAILED" }));
  assert.ok(isPaymentRetryable({ status: "PENDING", paymentStatus: "CANCELLED" }));
  assert.equal(isPaymentRetryable({ status: "PENDING", paymentStatus: "PAID" }), false);
  assert.equal(isPaymentRetryable({ status: "CONFIRMED", paymentStatus: "PAID" }), false);
  assert.equal(isPaymentRetryable({ status: "CANCELLED", paymentStatus: "PENDING" }), false);
});

test("stale: only old PENDING payments are stale; window is 15 minutes", () => {
  const now = new Date();
  const fresh = new Date(now.getTime() - 60_000);
  const stale = new Date(now.getTime() - PAYMENT_STALE_AFTER_MS - 1_000);
  assert.equal(isPaymentStale({ status: "PENDING", createdAt: fresh }, now), false);
  assert.equal(isPaymentStale({ status: "PENDING", createdAt: stale }, now), true);
  assert.equal(
    isPaymentStale({ status: "PAID", createdAt: stale }, now),
    false,
    "resolved payments never go stale"
  );
});

// ── Amount guards ──────────────────────────────────────────────────────

test("amounts: only positive safe integers within the cap are valid", () => {
  assert.ok(isValidServerAmount(1_000));
  assert.ok(isValidServerAmount(MAX_PAYMENT_AMOUNT_RIAL));
  assert.equal(isValidServerAmount(0), false);
  assert.equal(isValidServerAmount(-5), false);
  assert.equal(isValidServerAmount(1.5), false, "fractional Rial is never valid");
  assert.equal(isValidServerAmount(NaN), false);
  assert.equal(isValidServerAmount(Infinity), false);
  assert.equal(isValidServerAmount(MAX_PAYMENT_AMOUNT_RIAL + 1), false);
  assert.equal(isValidServerAmount("1000"), false, "no string coercion");
  assert.equal(isValidServerAmount(null), false);
});

test("amounts: assertServerAmount throws PaymentAmountError on corrupt values", () => {
  assert.doesNotThrow(() => assertServerAmount(500));
  assert.throws(() => assertServerAmount(0), PaymentAmountError);
  assert.throws(() => assertServerAmount(2.5), PaymentAmountError);
  assert.throws(() => assertServerAmount(Number.MAX_SAFE_INTEGER + 10), PaymentAmountError);
});

test("amounts: exact-match comparison, no tolerance, no coercion", () => {
  assert.ok(amountsMatch(1_250_000, 1_250_000));
  assert.equal(amountsMatch(1_250_000, 1_250_001), false);
  assert.equal(amountsMatch(1_250_000, 1_250_000.0), true);
  assert.equal(amountsMatch(0, 0), false, "zero is never a matchable amount");
  assert.equal(amountsMatch(-1, -1), false);
});

// ── Gateway reference validation ───────────────────────────────────────

test("gateway ref: opaque provider tokens accepted, hostile input rejected", () => {
  assert.ok(isValidGatewayRef(TXN_REF));
  assert.ok(isValidGatewayRef("authority-123_456"));
  assert.equal(isValidGatewayRef(""), false);
  assert.equal(isValidGatewayRef("short"), false);
  assert.equal(isValidGatewayRef(null), false);
  assert.equal(isValidGatewayRef(12345), false);
  assert.equal(
    isValidGatewayRef("<script>alert(1)</script>".padEnd(20, "x")),
    false,
    "markup never passes"
  );
  assert.equal(isValidGatewayRef("x".repeat(200)), false, "length-capped");
});

// ── Engine: successful transition ─────────────────────────────────────

test("engine: success transitions payment→PAID and order→CONFIRMED atomically", async () => {
  const store = makeFakeStore(makeView());
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.deepEqual(out, {
    ok: true,
    transitioned: true,
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
  });
  const after = store.view();
  assert.equal(after.payment.status, "PAID");
  assert.equal(after.payment.transactionId, TXN_REF);
  assert.equal(after.order.status, "CONFIRMED");
  assert.equal(after.order.paymentStatus, "PAID");
});

test("engine: failure keeps order PENDING (retryable) and mirrors paymentStatus", async () => {
  const store = makeFakeStore(makeView());
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, FAIL_INTENT);
  assert.deepEqual(out, {
    ok: true,
    transitioned: true,
    paymentStatus: "FAILED",
    orderStatus: null,
  });
  const after = store.view();
  assert.equal(after.payment.status, "FAILED");
  assert.equal(after.order.status, "PENDING", "order remains retryable");
  assert.equal(after.order.paymentStatus, "FAILED");
});

test("engine: cancelled mirrors CANCELLED, order stays PENDING", async () => {
  const store = makeFakeStore(makeView());
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, CANCEL_INTENT);
  assert.deepEqual(out, {
    ok: true,
    transitioned: true,
    paymentStatus: "CANCELLED",
    orderStatus: null,
  });
  const after = store.view();
  assert.equal(after.payment.status, "CANCELLED");
  assert.equal(after.order.status, "PENDING");
  assert.equal(after.order.paymentStatus, "CANCELLED");
});

// ── Engine: idempotency / duplicates ───────────────────────────────────

test("engine: duplicate success callback is a no-op (same reference)", async () => {
  const store = makeFakeStore(makeView());
  await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  const second = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.deepEqual(second, { ok: true, transitioned: false, paymentStatus: "PAID" });
  assert.equal(store.log.filter((l) => l.op === "success").length, 1);
});

test("engine: success with a DIFFERENT reference on a PAID payment is rejected", async () => {
  const store = makeFakeStore(makeView());
  await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, {
    kind: "SUCCESS",
    transactionId: TXN_REF_2,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "ALREADY_PAID");
  assert.equal(store.view().payment.transactionId, TXN_REF);
});

test("engine: duplicate failure/cancel callbacks are no-ops", async () => {
  const failed = makeFakeStore(makeView());
  await finalizePayment(failed, USER_A, PAYMENT_ID, FAIL_INTENT);
  const dup = await finalizePayment(failed, USER_A, PAYMENT_ID, FAIL_INTENT);
  assert.deepEqual(dup, { ok: true, transitioned: false, paymentStatus: "FAILED" });
  assert.equal(failed.log.filter((l) => l.op === "failure").length, 1);

  const cancelled = makeFakeStore(makeView());
  await finalizePayment(cancelled, USER_A, PAYMENT_ID, CANCEL_INTENT);
  const dupC = await finalizePayment(cancelled, USER_A, PAYMENT_ID, CANCEL_INTENT);
  assert.deepEqual(dupC, { ok: true, transitioned: false, paymentStatus: "CANCELLED" });
});

test("engine: race — concurrent writer won between read and write (store-level guard)", async () => {
  const store = makeFakeStore(makeView());
  const view = store.view();
  view.payment.status = "PAID";
  view.payment.transactionId = TXN_REF;
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.deepEqual(out, { ok: true, transitioned: false, paymentStatus: "PAID" });
  assert.equal(store.log.length, 0, "no write happened");
});

test("engine: state conflict (paired order guard) rolls back and never half-applies", async () => {
  const store = makeFakeStore(
    makeView({ orderStatus: "CONFIRMED", orderPaymentStatus: "PAID" })
  );
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "STATE_CONFLICT");
  assert.equal(store.log.length, 0);
  assert.equal(store.view().payment.status, "PENDING", "payment not half-paid");
});

// ── Engine: already-paid / invalid states ──────────────────────────────

test("engine: already-paid payment cannot be failed or cancelled", async () => {
  const store = makeFakeStore(
    makeView({
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      orderPaymentStatus: "PAID",
      transactionId: TXN_REF,
    })
  );
  for (const intent of [FAIL_INTENT, CANCEL_INTENT]) {
    const out = await finalizePayment(store, USER_A, PAYMENT_ID, intent);
    assert.equal(out.ok, false);
    assert.equal(out.reason, "ALREADY_PAID");
  }
  assert.equal(store.log.length, 0);
});

test("engine: FAILED payment cannot be cancelled or paid later", async () => {
  const store = makeFakeStore(makeView({ paymentStatus: "FAILED" }));
  const toCancel = await finalizePayment(store, USER_A, PAYMENT_ID, CANCEL_INTENT);
  assert.equal(toCancel.ok, false);
  assert.equal(toCancel.reason, "INVALID_TRANSITION");
  const toPaid = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.equal(toPaid.ok, false);
  assert.equal(toPaid.reason, "INVALID_TRANSITION");
});

// ── Engine: authorization ──────────────────────────────────────────────

test("engine: foreign user resolves to NOT_FOUND (existence never leaks)", async () => {
  const store = makeFakeStore(makeView());
  const out = await finalizePayment(store, USER_B, PAYMENT_ID, SUCCESS_INTENT);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "NOT_FOUND");
  assert.equal(store.log.length, 0);
});

test("engine: unknown payment id resolves to NOT_FOUND", async () => {
  const store = makeFakeStore(makeView());
  const out = await finalizePayment(store, USER_A, "paym_unknown0000000000", SUCCESS_INTENT);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "NOT_FOUND");
});

test("engine: malformed ids/inputs are rejected before any store access", async () => {
  const store = makeFakeStore(makeView());
  for (const bad of ["", "x", null, 42]) {
    const out = await finalizePayment(store, USER_A, bad, SUCCESS_INTENT);
    assert.equal(out.ok, false);
    assert.equal(out.reason, "INVALID_REQUEST");
  }
  const badRef = await finalizePayment(store, USER_A, PAYMENT_ID, {
    kind: "SUCCESS",
    transactionId: "no",
  });
  assert.equal(badRef.ok, false);
  assert.equal(badRef.reason, "INVALID_REQUEST");
  assert.equal(store.log.length, 0);
});

// ── Engine: amount validation ─────────────────────────────────────────

test("engine: stored amount must equal order total or success is refused", async () => {
  const store = makeFakeStore(makeView({ paymentAmount: 999_999 }));
  const out = await finalizePayment(store, USER_A, PAYMENT_ID, SUCCESS_INTENT);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "AMOUNT_MISMATCH");
  assert.equal(store.log.length, 0);
});

// ── Error message map ─────────────────────────────────────────────────

test("errors: every reject reason has a Persian message", () => {
  const reasons = [
    "INVALID_REQUEST",
    "NOT_FOUND",
    "FORBIDDEN",
    "ALREADY_PAID",
    "INVALID_TRANSITION",
    "AMOUNT_MISMATCH",
    "STATE_CONFLICT",
  ];
  for (const r of reasons) {
    const msg = paymentRejectMessage(r);
    assert.equal(typeof msg, "string");
    assert.ok(msg.length > 0);
    assert.ok(PAYMENT_REJECT_MESSAGES[r].length > 0);
  }
});

// ── ZarinPal adapter (live v4 implementation, mocked transport) ─────────

test("zarinpal: requestPayment posts to v4 request endpoint and returns redirect", async () => {
  let seenUrl = "";
  let seenBody = {};
  const fetchFn = makeFakeFetch((url, init) => {
    seenUrl = url;
    seenBody = JSON.parse(init.body);
    return zarinResponse({
      data: { code: 100, authority: AUTHORITY },
      errors: [],
    });
  });
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  const out = await gw.requestPayment({
    paymentId: PAYMENT_ID,
    amount: AMOUNT,
    description: "سفارش تست",
    callbackUrl: CALLBACK_URL,
  });
  assert.equal(out.authority, AUTHORITY);
  assert.equal(out.redirectUrl, `${ZARINPAL_PAY_ENDPOINT}/${AUTHORITY}`);
  assert.match(seenUrl, /payment\.zarinpal\.com\/pg\/v4\/payment\/request\.json$/);
  assert.equal(seenBody.amount, AMOUNT);
  assert.equal(seenBody.callback_url, CALLBACK_URL);
  assert.equal(seenBody.merchant_id, VALID_CONFIG.merchantId);
});

test("zarinpal: sandbox mode swaps both API and pay hosts", async () => {
  let seenUrl = "";
  const fetchFn = makeFakeFetch((url) => {
    seenUrl = url;
    return zarinResponse({ data: { code: 100, authority: AUTHORITY }, errors: [] });
  });
  const gw = new ZarinPalGateway(VALID_CONFIG_SANDBOX, fetchFn);
  const out = await gw.requestPayment({
    paymentId: PAYMENT_ID,
    amount: AMOUNT,
    description: "d",
    callbackUrl: CALLBACK_URL,
  });
  assert.match(seenUrl, /sandbox\.payment\.zarinpal\.com/);
  assert.equal(out.redirectUrl, `${ZARINPAL_SANDBOX_PAY_ENDPOINT}/${AUTHORITY}`);
});

test("zarinpal: request failure (provider error envelope) maps to REQUEST_FAILED", async () => {
  const fetchFn = makeFakeFetch(() =>
    zarinResponse({
      data: [],
      errors: { code: 11, message: "amount exceeds merchant limit" },
    })
  );
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  await assert.rejects(
    () =>
      gw.requestPayment({
        paymentId: PAYMENT_ID,
        amount: AMOUNT,
        description: "d",
        callbackUrl: CALLBACK_URL,
      }),
    (e) => e instanceof PaymentGatewayError && e.code === "REQUEST_FAILED"
  );
});

test("zarinpal: request failure (missing config) is rejected before any I/O", async () => {
  let called = false;
  const fetchFn = makeFakeFetch(() => {
    called = true;
    return zarinResponse({});
  });
  const gw = new ZarinPalGateway({ merchantId: "", sandbox: false }, fetchFn);
  await assert.rejects(
    () =>
      gw.requestPayment({
        paymentId: PAYMENT_ID,
        amount: AMOUNT,
        description: "d",
        callbackUrl: CALLBACK_URL,
      }),
    /config-missing/
  );
  assert.equal(called, false, "no network call without a valid config");
});

test("zarinpal: verifyPayment posts authoritative amount and returns refId", async () => {
  let seenBody = {};
  const fetchFn = makeFakeFetch((_url, init) => {
    seenBody = JSON.parse(init.body);
    return zarinResponse({ data: { code: 100, ref_id: 123456789 }, errors: [] });
  });
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  const out = await gw.verifyPayment({
    paymentId: PAYMENT_ID,
    amount: AMOUNT,
    authority: AUTHORITY,
  });
  assert.equal(out.refId, "123456789");
  assert.equal(seenBody.amount, AMOUNT, "verification uses the stored amount");
  assert.equal(seenBody.authority, AUTHORITY);
  assert.equal(seenBody.merchant_id, VALID_CONFIG.merchantId);
});

test("zarinpal: verify code 101 (verified before) is accepted as duplicate success", async () => {
  const fetchFn = makeFakeFetch(() =>
    zarinResponse({ data: { code: 101, ref_id: 123456789 }, errors: [] })
  );
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  const out = await gw.verifyPayment({
    paymentId: PAYMENT_ID,
    amount: AMOUNT,
    authority: AUTHORITY,
  });
  assert.equal(out.refId, "123456789");
});

test("zarinpal: verify rejection (not paid) maps to VERIFY_FAILED", async () => {
  const fetchFn = makeFakeFetch(() =>
    zarinResponse({ data: { code: -50, message: "not verified" }, errors: [] })
  );
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  await assert.rejects(
    () => gw.verifyPayment({ paymentId: PAYMENT_ID, amount: AMOUNT, authority: AUTHORITY }),
    (e) => e instanceof PaymentGatewayError && e.code === "VERIFY_FAILED"
  );
});

test("zarinpal: invalid authority is rejected before any I/O", async () => {
  let called = false;
  const fetchFn = makeFakeFetch(() => {
    called = true;
    return zarinResponse({});
  });
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  await assert.rejects(
    () => gw.verifyPayment({ paymentId: PAYMENT_ID, amount: AMOUNT, authority: "no" }),
    (e) => e instanceof PaymentGatewayError && e.code === "VERIFY_FAILED"
  );
  assert.equal(called, false);
});

test("zarinpal: provider timeout maps to TIMEOUT and never cancels anything itself", async () => {
  const fetchFn = makeFakeFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      })
  );
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  await assert.rejects(
    () =>
      gw.requestPayment({
        paymentId: PAYMENT_ID,
        amount: AMOUNT,
        description: "d",
        callbackUrl: CALLBACK_URL,
      }),
    (e) => e instanceof PaymentGatewayError && e.code === "TIMEOUT"
  );
});

test("zarinpal: malformed provider body maps to INVALID_RESPONSE", async () => {
  const fetchFn = makeFakeFetch(() => zarinResponse({ data: null, errors: [] }));
  const gw = new ZarinPalGateway(VALID_CONFIG, fetchFn);
  await assert.rejects(
    () =>
      gw.requestPayment({
        paymentId: PAYMENT_ID,
        amount: AMOUNT,
        description: "d",
        callbackUrl: CALLBACK_URL,
      }),
    (e) => e instanceof PaymentGatewayError && e.code === "INVALID_RESPONSE"
  );
});

test("zarinpal: config validation guards merchant UUID shape (secrets stay server-side)", () => {
  assert.ok(zarinPalConfigLooksValid(VALID_CONFIG));
  assert.equal(
    zarinPalConfigLooksValid({ merchantId: "short", sandbox: false }),
    false
  );
  assert.equal(
    zarinPalConfigLooksValid({ merchantId: "", sandbox: false }),
    false
  );
  const cfg = readZarinPalConfig();
  assert.equal(typeof cfg.merchantId, "string");
  assert.equal(typeof cfg.sandbox, "boolean");
});

test("zarinpal: transport error taxonomy is stable", () => {
  const e = zarinPalTransportError("TIMEOUT");
  assert.ok(e instanceof Error);
  assert.match(e.message, /PAYMENT_GATEWAY_TIMEOUT/);
});

test("zarinpal: callback params parse to a strict OK/NOK hint (never proof)", () => {
  assert.deepEqual(zarinPalParseCallback(new URLSearchParams("Authority=A&Status=OK")), {
    authority: "A",
    status: "OK",
  });
  assert.deepEqual(zarinPalParseCallback(new URLSearchParams("authority=A&status=NOK")), {
    authority: "A",
    status: "NOK",
  });
  assert.deepEqual(zarinPalParseCallback(new URLSearchParams("Status=OK")), {
    authority: null,
    status: "OK",
  });
  assert.deepEqual(zarinPalParseCallback(new URLSearchParams("Authority=A")), {
    authority: "A",
    status: null,
  });
  assert.deepEqual(zarinPalParseCallback(new URLSearchParams("Status=WEIRD")), {
    authority: null,
    status: null,
  });
  assert.equal(ZARINPAL_PROVIDER_ID, "ZARINPAL");
});

// ── Registry ───────────────────────────────────────────────────────────

test("registry: returns the live ZarinPal adapter; test override injectable", async () => {
  const gw = getPaymentGateway();
  assert.equal(gw.provider, "ZARINPAL");

  const fake = {
    provider: "ZARINPAL",
    async requestPayment() {
      return { authority: TXN_REF, redirectUrl: "https://pay.test/x" };
    },
    async verifyPayment() {
      return { refId: "ref-1" };
    },
  };
  setGatewayForTests(fake);
  assert.equal(getPaymentGateway(), fake);
  setGatewayForTests(null); // always restore
  assert.notEqual(getPaymentGateway(), fake);
});

// ── Flow: start (payment request) ─────────────────────────────────────

test("flow start: success — request created, authority persisted, redirect returned", async () => {
  const store = makeFakeStore(makeView());
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, START_INPUT);

  assert.ok(out.ok);
  assert.equal(out.kind, "REDIRECT");
  assert.equal(out.redirectUrl, `https://pay.test/${AUTHORITY}`);
  assert.equal(out.paymentId, PAYMENT_ID);
  // Gateway saw the authoritative stored amount — never client input.
  assert.equal(gw.calls[0].input.amount, AMOUNT);
  assert.equal(gw.calls[0].input.callbackUrl, CALLBACK_URL);
  // Authority persisted exactly once on the pending attempt.
  assert.deepEqual(
    store.log.filter((l) => l.op === "persist-authority"),
    [{ op: "persist-authority", paymentId: PAYMENT_ID, authority: AUTHORITY }]
  );
  // No success/failure writes, no new attempt rows.
  assert.equal(store.log.filter((l) => l.op === "success").length, 0);
  assert.equal(store.log.filter((l) => l.op === "failure").length, 0);
  assert.equal(store.log.filter((l) => l.op === "create-attempt").length, 0);
});

test("flow start: gateway request failure cancels the attempt (order stays retryable)", async () => {
  const store = makeFakeStore(makeView());
  const gw = makeFakeGateway({
    requestError: new PaymentGatewayError("REQUEST_FAILED", "test"),
  });
  const out = await startGatewayPayment(store, gw, START_INPUT);

  assert.equal(out.ok, false);
  assert.equal(out.code, "GATEWAY_ERROR");
  assert.equal(store.view().payment.status, "CANCELLED");
  assert.equal(store.view().order.status, "PENDING", "order preserved for retry");
  assert.equal(store.view().order.paymentStatus, "CANCELLED");
  assert.equal(store.log.filter((l) => l.op === "persist-authority").length, 0);
});

test("flow start: already-paid order never contacts the gateway", async () => {
  const store = makeFakeStore(
    makeView({ paymentStatus: "PAID", orderStatus: "CONFIRMED", orderPaymentStatus: "PAID", transactionId: TXN_REF })
  );
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, START_INPUT);
  assert.ok(out.ok);
  assert.equal(out.kind, "ALREADY_PAID");
  assert.equal(gw.calls.length, 0);
});

test("flow start: not-payable order (e.g. CANCELLED) is refused", async () => {
  const store = makeFakeStore(makeView({ orderStatus: "CANCELLED" }));
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, START_INPUT);
  assert.equal(out.ok, false);
  assert.equal(out.code, "NOT_PAYABLE");
  assert.equal(gw.calls.length, 0);
});

test("flow start: foreign/unknown order resolves to NOT_FOUND (no leak)", async () => {
  const store = makeFakeStore(makeView());
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, {
    ...START_INPUT,
    orderId: "order_unknown00000000",
  });
  assert.equal(out.ok, false);
  assert.equal(out.code, "NOT_FOUND");
  const outB = await startGatewayPayment(store, gw, {
    ...START_INPUT,
    userId: USER_B,
  });
  assert.equal(outB.ok, false);
  assert.equal(outB.code, "NOT_FOUND");
});

test("flow start: corrupt order amount is refused before the gateway call", async () => {
  const store = makeFakeStore(makeView({ orderTotal: 0, paymentAmount: 0 }));
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, START_INPUT);
  assert.equal(out.ok, false);
  assert.equal(out.code, "AMOUNT_INVALID");
  assert.equal(gw.calls.length, 0);
});

test("flow start: existing authority verifies on retry — VERIFIED_EXISTING settles the order", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY; // earlier attempt already opened
  const gw = makeFakeGateway();
  const out = await startGatewayPayment(store, gw, START_INPUT);

  assert.ok(out.ok);
  assert.equal(out.kind, "VERIFIED_EXISTING");
  assert.equal(store.view().payment.status, "PAID");
  assert.equal(store.view().order.status, "CONFIRMED");
  // No new gateway session was opened — only the re-verification ran.
  assert.equal(gw.calls.filter((c) => c.op === "request").length, 0);
  assert.equal(gw.calls.filter((c) => c.op === "verify").length, 1);
});

test("flow start: dead authority (verify refused) is cancelled and a NEW attempt opens", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway({ verifyRefusal: true });
  const out = await startGatewayPayment(store, gw, START_INPUT);

  assert.ok(out.ok);
  assert.equal(out.kind, "REDIRECT");
  // Old attempt cancelled; new attempt created and got the fresh authority.
  assert.equal(store.payments()[0].status, "CANCELLED");
  assert.equal(store.log.filter((l) => l.op === "create-attempt").length, 1);
  assert.equal(store.payments()[1].authority, AUTHORITY);
  assert.equal(store.view().order.status, "PENDING", "order stays retryable");
});

test("flow start: verification timeout on existing authority is left ambiguous (nothing written)", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway({
    verifyError: new PaymentGatewayError("TIMEOUT", "test"),
  });
  const out = await startGatewayPayment(store, gw, START_INPUT);

  assert.equal(out.ok, false);
  assert.equal(out.code, "GATEWAY_ERROR");
  assert.equal(store.view().payment.status, "PENDING", "ambiguous stays PENDING");
  assert.equal(store.log.length, 0);
});

// ── Flow: callback (verification-driven finalization) ──────────────────

test("flow callback: success — verified then paid, order confirmed, exactly one write", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });

  assert.equal(out.kind, "SUCCESS");
  assert.equal(out.paymentId, PAYMENT_ID);
  assert.equal(out.orderId, ORDER_ID);
  assert.equal(store.view().payment.status, "PAID");
  assert.equal(store.view().payment.transactionId, TXN_REF);
  assert.equal(store.view().order.status, "CONFIRMED");
  // Verification used the stored authoritative amount.
  assert.equal(gw.calls[0].input.amount, AMOUNT);
  assert.equal(gw.calls[0].input.authority, AUTHORITY);
});

test("flow callback: duplicate OK callback is idempotent (no second write)", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const first = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });
  assert.equal(first.kind, "SUCCESS");

  const second = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });
  assert.equal(second.kind, "ALREADY_PAID");
  assert.equal(store.log.filter((l) => l.op === "success").length, 1);
});

test("flow callback: NOK (user cancelled) cancels the attempt, order preserved", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "NOK",
  });

  assert.equal(out.kind, "CANCELLED");
  assert.equal(store.view().payment.status, "CANCELLED");
  assert.equal(store.view().order.status, "PENDING");
  assert.equal(store.view().order.paymentStatus, "CANCELLED");
  assert.equal(gw.calls.length, 0, "cancellation never triggers a verification");
});

test("flow callback: verification refusal marks FAILED, never success", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway({ verifyRefusal: true });

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });

  assert.equal(out.kind, "FAILED");
  assert.equal(store.view().payment.status, "FAILED");
  assert.equal(store.view().order.status, "PENDING");
  assert.equal(store.view().payment.transactionId, null);
});

test("flow callback: amount mismatch between stored rows refuses success", async () => {
  const store = makeFakeStore(makeView({ paymentAmount: AMOUNT - 1 }));
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });

  assert.equal(out.kind, "FAILED");
  assert.equal(gw.calls.length, 0, "no gateway call on a corrupt row");
  assert.equal(store.view().payment.status, "PENDING");
});

test("flow callback: invalid authority (unknown) resolves to INVALID", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY_2,
    statusHint: "OK",
  });
  assert.equal(out.kind, "INVALID");
  assert.equal(gw.calls.length, 0);
  assert.equal(store.view().payment.status, "PENDING");
});

test("flow callback: malformed/absent status is INVALID — nothing touched", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  for (const statusHint of [null]) {
    const out = await handleGatewayCallback(store, gw, {
      userId: USER_A,
      authority: AUTHORITY,
      statusHint,
    });
    assert.equal(out.kind, "INVALID");
  }
  assert.equal(store.log.length, 0);
  assert.equal(gw.calls.length, 0);
});

test("flow callback: unauthorized user (foreign authority) resolves to INVALID", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_B,
    authority: AUTHORITY,
    statusHint: "OK",
  });
  assert.equal(out.kind, "INVALID");
  assert.equal(gw.calls.length, 0);
  assert.equal(store.view().payment.status, "PENDING");
});

test("flow callback: already-paid payment on late callback stays paid", async () => {
  const store = makeFakeStore(
    makeView({ paymentStatus: "PAID", orderStatus: "CONFIRMED", orderPaymentStatus: "PAID", transactionId: TXN_REF })
  );
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });
  assert.equal(out.kind, "ALREADY_PAID");
  assert.equal(gw.calls.length, 0, "no re-verification for a settled payment");
  assert.equal(store.view().payment.status, "PAID");
  assert.equal(store.view().payment.transactionId, TXN_REF);
});

test("flow callback: terminal FAILED attempt claiming OK is never auto-paid", async () => {
  const store = makeFakeStore(makeView({ paymentStatus: "FAILED" }));
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway();

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });
  // Money may have moved — surfaced for review; the terminal state is not
  // flipped automatically and success is never claimed without the engine.
  assert.equal(out.kind, "VERIFY_ERROR");
  assert.equal(store.view().payment.status, "FAILED");
});

test("flow callback: provider timeout keeps payment PENDING (در حال بررسی)", async () => {
  const store = makeFakeStore(makeView());
  store.payments()[0].authority = AUTHORITY;
  const gw = makeFakeGateway({
    verifyError: new PaymentGatewayError("TIMEOUT", "test"),
  });

  const out = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority: AUTHORITY,
    statusHint: "OK",
  });

  assert.equal(out.kind, "VERIFY_ERROR");
  assert.equal(store.view().payment.status, "PENDING");
  assert.equal(store.view().order.status, "PENDING");
  assert.equal(store.log.length, 0, "ambiguous outcome writes nothing");
});

test("flow: full journey — start → callback success → duplicate callback", async () => {
  const store = makeFakeStore(makeView());
  const gw = makeFakeGateway();

  const start = await startGatewayPayment(store, gw, START_INPUT);
  assert.ok(start.ok && start.kind === "REDIRECT");
  const authority = store.payments()[0].authority;
  assert.ok(authority);

  const cb = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority,
    statusHint: "OK",
  });
  assert.equal(cb.kind, "SUCCESS");

  const dup = await handleGatewayCallback(store, gw, {
    userId: USER_A,
    authority,
    statusHint: "OK",
  });
  assert.equal(dup.kind, "ALREADY_PAID");

  // Exactly one success write; inventory/order creation never re-ran.
  assert.equal(store.log.filter((l) => l.op === "success").length, 1);
  assert.equal(store.log.filter((l) => l.op === "create-attempt").length, 0);
});

// ── UX state mapping ───────────────────────────────────────────────────

test("ux: all Persian/RTL gateway states exist with copy", () => {
  const states = [
    "redirecting",
    "verifying",
    "success",
    "failed",
    "cancelled",
    "already-paid",
    "gateway-error",
  ];
  for (const s of states) {
    const copy = GATEWAY_UX_COPY[s];
    assert.ok(copy.title.length > 0);
    assert.ok(copy.description.length > 0);
  }
  assert.equal(GATEWAY_UX_COPY.redirecting.title, "در حال انتقال به درگاه…");
  assert.equal(GATEWAY_UX_COPY.verifying.title, "در حال بررسی پرداخت…");
  assert.equal(GATEWAY_UX_COPY.success.title, "پرداخت موفق");
  assert.equal(GATEWAY_UX_COPY.failed.title, "پرداخت ناموفق");
  assert.equal(GATEWAY_UX_COPY.cancelled.title, "پرداخت لغو شد");
  assert.equal(GATEWAY_UX_COPY["gateway-error"].title, "خطای ارتباط با درگاه");
  assert.equal(GATEWAY_UX_COPY["already-paid"].title, "پرداخت قبلاً ثبت شده");
});

test("ux: callback outcomes map to the right UX state", () => {
  assert.equal(callbackOutcomeToUx({ kind: "SUCCESS", paymentId: PAYMENT_ID, orderId: ORDER_ID }), "success");
  assert.equal(callbackOutcomeToUx({ kind: "ALREADY_PAID", paymentId: PAYMENT_ID, orderId: ORDER_ID }), "already-paid");
  assert.equal(callbackOutcomeToUx({ kind: "CANCELLED", paymentId: PAYMENT_ID, orderId: ORDER_ID }), "cancelled");
  assert.equal(callbackOutcomeToUx({ kind: "FAILED", paymentId: PAYMENT_ID, orderId: ORDER_ID }), "failed");
  assert.equal(callbackOutcomeToUx({ kind: "VERIFY_ERROR", paymentId: PAYMENT_ID, orderId: ORDER_ID }), "verifying");
  assert.equal(callbackOutcomeToUx({ kind: "INVALID" }), "gateway-error");
});

test("ux: start outcomes and reject reasons map to safe UX states", () => {
  assert.equal(
    startOutcomeToUx({ ok: true, kind: "REDIRECT", paymentId: PAYMENT_ID, redirectUrl: "https://x" }),
    "redirecting"
  );
  assert.equal(rejectReasonToUx("ALREADY_PAID"), "already-paid");
  assert.equal(rejectReasonToUx("AMOUNT_MISMATCH"), "failed");
  assert.equal(rejectReasonToUx("STATE_CONFLICT"), "gateway-error");
});

// ── Module purity ──────────────────────────────────────────────────────

test("engine modules stay DB-free: pure surface imports cleanly in a bare node process", async () => {
  const mod = await import("./engine.ts");
  assert.equal(typeof mod.finalizePayment, "function");
  const status = await import("./status.ts");
  assert.equal(typeof status.canTransitionPaymentStatus, "function");
  const flow = await import("./flow.ts");
  assert.equal(typeof flow.startGatewayPayment, "function");
  assert.equal(typeof flow.handleGatewayCallback, "function");
});
