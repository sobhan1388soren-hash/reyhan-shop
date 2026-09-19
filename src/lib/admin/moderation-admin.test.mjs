// Unit tests — Phase 14 Part 2 review & Q&A moderation admin rules (pure).
// Authorization and target validation only; the moderation flows themselves
// are covered by the existing reviews suite.

import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEW_MODERATION_STATUSES,
  QUESTION_ADMIN_STATUSES,
  isReviewModerationStatus,
  isQuestionAdminStatus,
  evaluateReviewModeration,
  evaluateQuestionAnswer,
  evaluateQuestionModeration,
  MODERATION_ADMIN_MESSAGES,
} from "./moderation-admin-rules.ts";

test("moderation status vocabularies match the schema enums", () => {
  assert.deepEqual([...REVIEW_MODERATION_STATUSES], ["PENDING", "APPROVED", "REJECTED"]);
  assert.deepEqual([...QUESTION_ADMIN_STATUSES], ["PENDING", "ANSWERED", "CLOSED"]);
  assert.equal(isReviewModerationStatus("APPROVED"), true);
  assert.equal(isReviewModerationStatus("CLOSED"), false);
  assert.equal(isQuestionAdminStatus("CLOSED"), true);
  assert.equal(isQuestionAdminStatus("REJECTED"), false);
});

test("review moderation: ADMIN/STAFF allowed, others forbidden", () => {
  for (const role of ["ADMIN", "STAFF"]) {
    assert.deepEqual(evaluateReviewModeration(role, "APPROVED"), { ok: true });
    assert.deepEqual(evaluateReviewModeration(role, "REJECTED"), { ok: true });
  }
  for (const role of ["CUSTOMER", "", "SUPERADMIN"]) {
    assert.deepEqual(evaluateReviewModeration(role, "APPROVED"), {
      ok: false,
      code: "FORBIDDEN",
    });
  }
});

test("review moderation: forged target status rejected", () => {
  assert.deepEqual(evaluateReviewModeration("ADMIN", "DELETED"), {
    ok: false,
    code: "VALIDATION",
  });
});

test("Q&A answer: staff capability enforced", () => {
  assert.deepEqual(evaluateQuestionAnswer("ADMIN"), { ok: true });
  assert.deepEqual(evaluateQuestionAnswer("STAFF"), { ok: true });
  assert.deepEqual(evaluateQuestionAnswer("CUSTOMER"), { ok: false, code: "FORBIDDEN" });
});

test("Q&A moderation: staff capability + valid target", () => {
  assert.deepEqual(evaluateQuestionModeration("ADMIN", "CLOSED"), { ok: true });
  assert.deepEqual(evaluateQuestionModeration("STAFF", "PENDING"), { ok: true });
  assert.deepEqual(evaluateQuestionModeration("CUSTOMER", "CLOSED"), {
    ok: false,
    code: "FORBIDDEN",
  });
  assert.deepEqual(evaluateQuestionModeration("ADMIN", "OPEN"), {
    ok: false,
    code: "VALIDATION",
  });
});

test("every moderation admin error code has Persian copy", () => {
  for (const code of ["FORBIDDEN", "NOT_FOUND", "VALIDATION", "UNAVAILABLE", "DB_ERROR"]) {
    assert.ok(MODERATION_ADMIN_MESSAGES[code]?.length > 0, code);
  }
});