// Phase 4.4 — Reviews, ratings & Q&A UI-layer contract tests.
//
// Scope: the TS modules the review/Q&A UIs are built on that are pure and
// therefore testable in a bare `node --test` process:
//   - ./form-state.ts      (shared useActionState seed for ReviewForm / QuestionForm)
//   - ../admin/labels.ts   (review & question status presentation maps)
//   - ../admin/options.ts  (admin moderation filter option lists)
//   - ../catalog/format.ts (Persian digit/date presentation used by reviews.tsx)
//
// The .tsx components themselves (review-form.tsx, question-form.tsx,
// reviews.tsx, admin moderation actions) contain JSX, which the bare-node
// type-stripping runner cannot transform, and the repo has no React
// component test infrastructure — component rendering is verified by code
// review + the pure flows in reviews.test.mjs (noted as a limitation).
//
// Run: node --test src/lib/reviews/reviews-ui.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  initialReviewFormState,
  initialQuestionFormState,
} from "./form-state.ts";

import {
  reviewStatusLabels,
  reviewStatusTones,
  questionStatusLabels,
  questionStatusTones,
} from "../admin/labels.ts";

import {
  ADMIN_REVIEW_STATUS_OPTIONS,
  ADMIN_QUESTION_STATUS_OPTIONS,
} from "../admin/options.ts";

import {
  REVIEW_MODERATION_STATUSES,
  QUESTION_ADMIN_STATUSES,
} from "../admin/moderation-admin-rules.ts";

import { toFaDigits, formatNumber } from "../catalog/format.ts";

// ── Form state seeds (useActionState initial values) ───────────────────

test("initialReviewFormState is idle and empty — no fabricated feedback", () => {
  assert.deepEqual(initialReviewFormState, { status: "idle" });
});

test("initialQuestionFormState is idle and empty — no fabricated feedback", () => {
  assert.deepEqual(initialQuestionFormState, { status: "idle" });
});

// ── Review status presentation (admin reviews list badges) ─────────────

const TONES = ["neutral", "info", "success", "warning", "danger"];

test("review status labels cover exactly the schema enum with Persian copy", () => {
  assert.deepEqual(Object.keys(reviewStatusLabels).sort(), ["APPROVED", "PENDING", "REJECTED"]);
  for (const label of Object.values(reviewStatusLabels)) {
    assert.ok(typeof label === "string" && label.length > 0);
  }
});

test("review status tones cover exactly the schema enum and use the shared vocabulary", () => {
  assert.deepEqual(Object.keys(reviewStatusTones).sort(), ["APPROVED", "PENDING", "REJECTED"]);
  for (const tone of Object.values(reviewStatusTones)) {
    assert.ok(TONES.includes(tone), `${tone} must be a known StatusTone`);
  }
});

test("review status tone meaning: pending=warning, approved=success, rejected=danger", () => {
  assert.equal(reviewStatusTones.PENDING, "warning");
  assert.equal(reviewStatusTones.APPROVED, "success");
  assert.equal(reviewStatusTones.REJECTED, "danger");
});

// ── Question status presentation (admin Q&A list badges) ───────────────

test("question status labels cover exactly the schema enum with Persian copy", () => {
  assert.deepEqual(Object.keys(questionStatusLabels).sort(), ["ANSWERED", "CLOSED", "PENDING"]);
  for (const label of Object.values(questionStatusLabels)) {
    assert.ok(typeof label === "string" && label.length > 0);
  }
});

test("question status tones cover exactly the schema enum and use the shared vocabulary", () => {
  assert.deepEqual(Object.keys(questionStatusTones).sort(), ["ANSWERED", "CLOSED", "PENDING"]);
  for (const tone of Object.values(questionStatusTones)) {
    assert.ok(TONES.includes(tone), `${tone} must be a known StatusTone`);
  }
});

test("question status tone meaning: pending=warning, answered=success, closed=neutral", () => {
  assert.equal(questionStatusTones.PENDING, "warning");
  assert.equal(questionStatusTones.ANSWERED, "success");
  assert.equal(questionStatusTones.CLOSED, "neutral");
});

// ── Admin filter options consistency (UI offers == server rules accept) ─

test("review status filter options are exactly the moderation vocabulary", () => {
  const optionValues = ADMIN_REVIEW_STATUS_OPTIONS.map((o) => o.value).sort();
  assert.deepEqual(optionValues, [...REVIEW_MODERATION_STATUSES].sort());
  // Every option label comes from the shared Persian label map (no duplicates).
  for (const o of ADMIN_REVIEW_STATUS_OPTIONS) {
    assert.equal(o.label, reviewStatusLabels[o.value]);
  }
});

test("question status filter options are exactly the moderation vocabulary", () => {
  const optionValues = ADMIN_QUESTION_STATUS_OPTIONS.map((o) => o.value).sort();
  assert.deepEqual(optionValues, [...QUESTION_ADMIN_STATUSES].sort());
  for (const o of ADMIN_QUESTION_STATUS_OPTIONS) {
    assert.equal(o.label, questionStatusLabels[o.value]);
  }
});

// ── Persian digit presentation used across the review/Q&A sections ─────

test("toFaDigits converts Latin digits and preserves non-digit characters", () => {
  assert.equal(toFaDigits("3"), "۳");
  assert.equal(toFaDigits("4.5"), "۴.۵");
  assert.equal(toFaDigits(42), "۴۲");
  assert.equal(toFaDigits("از 5 دیدگاه"), "از ۵ دیدگاه");
  assert.equal(toFaDigits(""), "");
});

test("formatNumber groups thousands then Persian digits", () => {
  assert.equal(formatNumber(1000), "۱,۰۰۰");
  assert.equal(formatNumber(0), "۰");
});
