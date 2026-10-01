// Notification tests — Phase 21.
//
// Covers:
//   - Message templates (ORDER_PLACED, ORDER_PAID, ORDER_SHIPPED, PRICE_DROP, BACK_IN_STOCK)
//   - Notification sender (provider selection, request shaping)
//
// Pure, DB-free — runs against the ./templates and ./sender modules
// so no real network call or database is ever made.
//
// Run: npm run test:notifications

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNotificationMessage,
  formatPriceForSms,
} from "./templates.ts";

const SITE_NAME = "ریحان";

// ── Templates ──────────────────────────────────────────────────────────────

test("ORDER_PLACED message includes order number", () => {
  const msg = buildNotificationMessage("ORDER_PLACED", {
    orderNumber: "RHN-۱۲۳۴",
  });
  assert.ok(msg.includes("RHN-۱۲۳۴"));
  assert.ok(msg.includes("ثبت شد"));
  assert.ok(msg.includes("منتظر"));
});

test("ORDER_PAID message includes order number", () => {
  const msg = buildNotificationMessage("ORDER_PAID", {
    orderNumber: "RHN-5678",
  });
  assert.ok(msg.includes("RHN-5678"));
  assert.ok(msg.includes("تأیید"));
  assert.ok(msg.includes("پرداخت"));
});

test("ORDER_SHIPPED message includes order number and tracking code", () => {
  const msg = buildNotificationMessage("ORDER_SHIPPED", {
    orderNumber: "RHN-9999",
    trackingCode: "۱۲۳۴۵۶۷۸۹۰",
  });
  assert.ok(msg.includes("RHN-9999"));
  assert.ok(msg.includes("۱۲۳۴۵۶۷۸۹۰"));
  assert.ok(msg.includes("رهگیری"));
});

test("ORDER_SHIPPED without tracking code is a generic shipped message", () => {
  const msg = buildNotificationMessage("ORDER_SHIPPED", {
    orderNumber: "RHN-1111",
    trackingCode: undefined,
  });
  assert.ok(msg.includes("RHN-1111"));
  assert.ok(msg.includes("ارسال"));
  assert.ok(!msg.includes("رهگیری")); // no tracking code mentioned
});

test("PRICE_DROP message includes product title and formatted price", () => {
  const msg = buildNotificationMessage("PRICE_DROP", {
    productTitle: "فیلتر تصفیه آب",
    newPrice: 1500000,
  });
  assert.ok(msg.includes("فیلتر تصفیه آب"));
  assert.ok(msg.includes("کاهش"));
  assert.ok(msg.includes("تومان"));
  assert.ok(msg.includes("۱"));
  assert.ok(msg.includes("۵"));
  assert.ok(msg.includes("۰"));
});

test("BACK_IN_STOCK message includes product title", () => {
  const msg = buildNotificationMessage("BACK_IN_STOCK", {
    productTitle: "دستگاه تصفیه آب",
  });
  assert.ok(msg.includes("دستگاه تصفیه آب"));
  assert.ok(msg.includes("موجود"));
  assert.ok(msg.includes("فرصت"));
});

test("formatPriceForSms converts numbers to Persian digits", () => {
  assert.equal(formatPriceForSms(0), "۰");
  assert.equal(formatPriceForSms(1234567), "۱۲۳۴۵۶۷");
  assert.equal(formatPriceForSms(9999999), "۹۹۹۹۹۹۹");
});

test("buildNotificationMessage throws on unknown template", () => {
  assert.throws(
    () =>
      buildNotificationMessage(
        // testing invalid input
        "UNKNOWN_TEMPLATE",
        {}
      ),
    TypeError
  );
});

// ── Template consistency ───────────────────────────────────────────────────────

test("every template includes site name", () => {
  const templates = [
    { key: "ORDER_PLACED", input: { orderNumber: "RHN-1" } },
    { key: "ORDER_PAID", input: { orderNumber: "RHN-1" } },
    { key: "ORDER_SHIPPED", input: { orderNumber: "RHN-1", trackingCode: "ABC123" } },
    { key: "PRICE_DROP", input: { productTitle: "Test", newPrice: 1000 } },
    { key: "BACK_IN_STOCK", input: { productTitle: "Test" } },
  ];

  for (const { key, input } of templates) {
    const msg = buildNotificationMessage(key, input);
    assert.ok(
      msg.includes(SITE_NAME) || msg.endsWith(SITE_NAME) || msg.includes(` ${SITE_NAME}`),
      `template ${key} should include site name in message: ${msg}`
    );
  }
});

test("order messages do not include product title (not applicable)", () => {
  const msg = buildNotificationMessage("ORDER_PLACED", {
    orderNumber: "RHN-1",
  });
  assert.ok(!msg.includes("محصول"), "order message should not mention product");
});

test("alert messages do not reference an order number", () => {
  const msg = buildNotificationMessage("PRICE_DROP", {
    productTitle: "فیلتر",
    newPrice: 500000,
  });
  // "سفارش دهید" (order now) is a valid CTA — but no order number should appear.
  assert.ok(!msg.includes("شماره سفارش"));
  assert.ok(!msg.includes("RHN-"));
});