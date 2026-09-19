// Review & Q&A moderation administration — pure authorization/validation
// rules for the admin UI (Phase 14, Part 2).
//
// The actual moderation flows live in src/lib/reviews/rules.ts and are
// invoked through the existing reviews service; this module only performs
// the role + target checks before those flows run, so the admin UI has a
// testable, DB-free authorization surface (mirrors the other admin rules).

import type { ReviewStatus, QuestionStatus } from "@prisma/client";
import {
  canModerateReview,
  canAnswerQuestions,
  canModerateQuestions,
} from "../reviews/rules.ts";

export const REVIEW_MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const QUESTION_ADMIN_STATUSES = ["PENDING", "ANSWERED", "CLOSED"] as const;
export type QuestionAdminStatus = (typeof QUESTION_ADMIN_STATUSES)[number];

export function isReviewModerationStatus(value: string): value is ReviewModerationStatus {
  return (REVIEW_MODERATION_STATUSES as readonly string[]).includes(value);
}

export function isQuestionAdminStatus(value: string): value is QuestionAdminStatus {
  return (QUESTION_ADMIN_STATUSES as readonly string[]).includes(value);
}

export type ModerationAdminErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAVAILABLE"
  | "DB_ERROR";

export const MODERATION_ADMIN_MESSAGES: Readonly<Record<ModerationAdminErrorCode, string>> = {
  FORBIDDEN: "شما به این عملیات دسترسی ندارید.",
  NOT_FOUND: "مورد درخواستی یافت نشد.",
  VALIDATION: "درخواست معتبر نیست.",
  UNAVAILABLE: "عملیات در حال حاضر ممکن نشد. دوباره تلاش کنید.",
  DB_ERROR: "عملیات با خطا مواجه شد. دوباره تلاش کنید.",
};

/**
 * Map ANY outcome code (including the reviews service's own codes such as
 * UNAUTHENTICATED / INVALID_INPUT / INVALID_TRANSITION) to safe Persian
 * copy, never leaking a raw code to the admin.
 */
export function moderationAdminMessage(code: string): string {
  return (
    (MODERATION_ADMIN_MESSAGES as Record<string, string>)[code] ??
    MODERATION_ADMIN_MESSAGES.UNAVAILABLE
  );
}

export type ModerationEvaluation =
  | { ok: true }
  | { ok: false; code: ModerationAdminErrorCode };

/** Approve/reject a review — ADMIN/STAFF only. */
export function evaluateReviewModeration(role: string, to: string): ModerationEvaluation {
  if (!canModerateReview(role)) return { ok: false, code: "FORBIDDEN" };
  if (!isReviewModerationStatus(to)) return { ok: false, code: "VALIDATION" };
  return { ok: true };
}

/** Answer a question — ADMIN/STAFF only. */
export function evaluateQuestionAnswer(role: string): ModerationEvaluation {
  if (!canAnswerQuestions(role)) return { ok: false, code: "FORBIDDEN" };
  return { ok: true };
}

/** Open/close a question — ADMIN/STAFF only. */
export function evaluateQuestionModeration(role: string, to: string): ModerationEvaluation {
  if (!canModerateQuestions(role)) return { ok: false, code: "FORBIDDEN" };
  if (!isQuestionAdminStatus(to)) return { ok: false, code: "VALIDATION" };
  return { ok: true };
}

export type { ReviewStatus, QuestionStatus };