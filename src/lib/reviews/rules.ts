// Reviews & Q&A domain — pure validation and authorization rules.
//
// This module is deliberately DB-free and server-only-free so it is unit-
// testable in a bare `node --test` process (mirroring checkout/payments).
// The Prisma-backed service (./service) calls these rules; the server
// actions (src/app/actions/reviews) call the service.
//
// Security model:
//   - Verified-purchaser status is ALWAYS derived server-side from real
//     Order/OrderItem rows; a client-provided flag never reaches here.
//   - Moderation state is decided exclusively by authorized roles; users
//     can never set APPROVED/REJECTED on their own submissions.
//   - Answering questions is restricted to ADMIN/STAFF roles resolved
//     from the signed session, never from request payload.

// ── Reviews ────────────────────────────────────────────────────────────

export const MIN_RATING = 1 as const;
export const MAX_RATING = 5 as const;

export const REVIEW_TITLE_MIN = 2 as const;
export const REVIEW_TITLE_MAX = 120 as const;
export const REVIEW_COMMENT_MIN = 5 as const;
export const REVIEW_COMMENT_MAX = 2000 as const;

export type ReviewInput = {
  rating: number;
  title: string | null;
  comment: string | null;
};

export type ReviewValidation =
  | { ok: true; data: { rating: number; title: string | null; comment: string | null } }
  | { ok: false; errors: Partial<Record<"rating" | "title" | "comment", string>> };

export function isValidRating(rating: unknown): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= MIN_RATING &&
    rating <= MAX_RATING
  );
}

export function validateReviewInput(raw: {
  rating?: unknown;
  title?: unknown;
  comment?: unknown;
}): ReviewValidation {
  const errors: Partial<Record<"rating" | "title" | "comment", string>> = {};

  const rating = typeof raw.rating === "number" ? raw.rating : Number.NaN;
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    errors.rating = `امتیاز باید بین ${MIN_RATING} تا ${MAX_RATING} ستاره باشد.`;
  }

  let title: string | null = null;
  if (typeof raw.title === "string" && raw.title.trim()) {
    const trimmed = raw.title.trim();
    if (trimmed.length < REVIEW_TITLE_MIN || trimmed.length > REVIEW_TITLE_MAX) {
      errors.title = `عنوان دیدگاه باید بین ${REVIEW_TITLE_MIN} تا ${REVIEW_TITLE_MAX} نویسه باشد.`;
    } else {
      title = trimmed;
    }
  }

  let comment: string | null = null;
  if (typeof raw.comment === "string" && raw.comment.trim()) {
    const trimmed = raw.comment.trim();
    if (trimmed.length < REVIEW_COMMENT_MIN || trimmed.length > REVIEW_COMMENT_MAX) {
      errors.comment = `متن دیدگاه باید بین ${REVIEW_COMMENT_MIN} تا ${REVIEW_COMMENT_MAX} نویسه باشد.`;
    } else {
      comment = trimmed;
    }
  }

  if (comment === null && title === null) {
    // A review with no text at all carries no community value — require
    // at least the comment OR a title.
    errors.comment = "متن دیدگاه را وارد کنید.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { rating, title, comment } };
}

/** Review moderation is an admin/staff capability — enforced server-side. */
export function canModerateReview(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

// ── Q&A ────────────────────────────────────────────────────────────────

export const QUESTION_MIN = 5 as const;
export const QUESTION_MAX = 500 as const;
export const ANSWER_MIN = 2 as const;
export const ANSWER_MAX = 2000 as const;

export function validateQuestionInput(raw: {
  question?: unknown;
}): { ok: true; data: string } | { ok: false; errors: { question?: string } } {
  const question =
    typeof raw.question === "string" ? raw.question.trim() : "";
  if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
    return {
      ok: false,
      errors: {
        question: `پرسش باید بین ${QUESTION_MIN} تا ${QUESTION_MAX} نویسه باشد.`,
      },
    };
  }
  return { ok: true, data: question };
}

export function validateAnswerInput(raw: {
  answer?: unknown;
}): { ok: true; data: string } | { ok: false; errors: { answer?: string } } {
  const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
  if (answer.length < ANSWER_MIN || answer.length > ANSWER_MAX) {
    return {
      ok: false,
      errors: {
        answer: `پاسخ باید بین ${ANSWER_MIN} تا ${ANSWER_MAX} نویسه باشد.`,
      },
    };
  }
  return { ok: true, data: answer };
}

/** Answering questions is a staff capability — enforced server-side. */
export function canAnswerQuestions(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

/** Moderating questions (open/close) is an admin capability. */
export function canModerateQuestions(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

// ── Public visibility (server-side list filters) ───────────────────────

/**
 * Which question rows may be listed publicly on a product page.
 * The existing QuestionStatus enum is PENDING / ANSWERED / CLOSED:
 * a PENDING question has not been reviewed/answered yet and stays
 * private; ANSWERED is publicly visible; CLOSED is archived.
 */
export const PUBLIC_QUESTION_STATUSES: readonly ["ANSWERED"] = ["ANSWERED"];

export function isPubliclyVisibleQuestion(status: string): boolean {
  return (PUBLIC_QUESTION_STATUSES as readonly string[]).includes(status);
}

/** Only APPROVED reviews are ever publicly listed. */
export function isPubliclyVisibleReview(status: string): boolean {
  return status === "APPROVED";
}

/**
 * Verified purchaser = at least one paid, non-cancelled order of THIS
 * user containing THIS product. The caller supplies DB-derived order
 * facts; this pure rule only filters which rows count.
 */
export function hasPurchasedProductIn(
  orders: { userId: string | null; paymentStatus: string; status: string; productIds: string[] }[],
  userId: string,
  productId: string
): boolean {
  return orders.some(
    (o) =>
      o.userId === userId &&
      o.paymentStatus === "PAID" &&
      o.status !== "CANCELLED" &&
      o.status !== "RETURNED" &&
      o.productIds.includes(productId)
  );
}

/**
 * Which order rows count as a genuine purchase — active fulfillment
 * chain after successful payment (PENDING through DELIVERED).
 */
export const PURCHASE_ORDER_STATUSES: readonly [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function isPurchaseOrderStatus(status: string): boolean {
  return (PURCHASE_ORDER_STATUSES as readonly string[]).includes(status);
}

// ── Pure orchestration over an injectable store ────────────────────────
//
// The Prisma adapter (./service) implements this narrow port; unit tests
// inject an in-memory fake with identical semantics. All authorization
// and verification decisions live HERE, independent of any database.

export type StoreUserRow = { id: string; role: string };
export type StoreProductRow = { id: string; status: string };
export type StoreReviewRow = { id: string; productId: string; userId: string; status: string };
export type StoreQuestionRow = { id: string; productId: string; userId: string; status: string };
export type StoreOrderRow = {
  userId: string | null;
  paymentStatus: string;
  status: string;
  productIds: string[];
};

/** Narrow persistence port for the pure flow functions below. */
export interface ReviewsStore {
  findProductById(productId: string): Promise<StoreProductRow | null>;
  findReviewByProductAndUser(
    productId: string,
    userId: string
  ): Promise<StoreReviewRow | null>;
  findReviewById(reviewId: string): Promise<StoreReviewRow | null>;
  listOrdersForUser(userId: string): Promise<StoreOrderRow[]>;
  createReview(input: {
    productId: string;
    userId: string;
    rating: number;
    title: string | null;
    comment: string | null;
    status: string;
  }): Promise<{ id: string }>;
  updateReviewStatus(reviewId: string, status: string): Promise<void>;
  findQuestionById(questionId: string): Promise<StoreQuestionRow | null>;
  createQuestion(input: {
    productId: string;
    userId: string;
    question: string;
    status: string;
  }): Promise<{ id: string }>;
  createAnswer(input: { questionId: string; userId: string; answer: string }): Promise<{ id: string }>;
  updateQuestionStatus(questionId: string, status: string): Promise<void>;
}

export type SubmitReviewCode =
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "PRODUCT_NOT_FOUND"
  | "NOT_VERIFIED_PURCHASER"
  | "ALREADY_REVIEWED"
  | "UNAVAILABLE";

export type SubmitReviewOutcome =
  | { ok: true; status: "PENDING" }
  | { ok: false; code: SubmitReviewCode; errors?: Record<string, string> };

/**
 * Submit a review. Always lands as PENDING — there is NO input to this
 * function that can produce a publicly visible review; only the
 * admin-gated moderateReview can approve.
 */
export async function submitReviewFlow(
  store: ReviewsStore,
  userId: string | null,
  productId: string,
  input: { rating?: unknown; title?: unknown; comment?: unknown }
): Promise<SubmitReviewOutcome> {
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };

  const validation = validateReviewInput(input);
  if (!validation.ok) {
    return { ok: false, code: "INVALID_INPUT", errors: validation.errors };
  }

  const product = await store.findProductById(productId);
  if (!product || product.status !== "ACTIVE") {
    return { ok: false, code: "PRODUCT_NOT_FOUND" };
  }

  // Verified-purchaser gate — computed from real order rows only.
  const orders = await store.listOrdersForUser(userId);
  const purchased = hasPurchasedProductIn(orders, userId, productId);
  if (!purchased) return { ok: false, code: "NOT_VERIFIED_PURCHASER" };

  const existing = await store.findReviewByProductAndUser(productId, userId);
  if (existing) return { ok: false, code: "ALREADY_REVIEWED" };

  try {
    await store.createReview({
      productId,
      userId,
      rating: validation.data.rating,
      title: validation.data.title,
      comment: validation.data.comment,
      status: "PENDING",
    });
    return { ok: true, status: "PENDING" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export type ModerateReviewOutcome =
  | { ok: true; status: string }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_TRANSITION" };

/** Approve/reject a review — ADMIN/STAFF only (role from session). */
export async function moderateReviewFlow(
  store: ReviewsStore,
  userId: string | null,
  role: string,
  reviewId: string,
  to: "PENDING" | "APPROVED" | "REJECTED"
): Promise<ModerateReviewOutcome> {
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };
  if (!canModerateReview(role)) return { ok: false, code: "FORBIDDEN" };
  if (!["PENDING", "APPROVED", "REJECTED"].includes(to)) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }

  const existing = await store.findReviewById(reviewId);
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (existing.status === to) return { ok: true, status: to };

  await store.updateReviewStatus(reviewId, to);
  return { ok: true, status: to };
}

export type AskQuestionOutcome =
  | { ok: true; status: "PENDING" }
  | { ok: false; code: "UNAUTHENTICATED" | "INVALID_INPUT" | "PRODUCT_NOT_FOUND" | "UNAVAILABLE"; errors?: Record<string, string> };

/** Ask a product question — any authenticated user; always PENDING. */
export async function askQuestionFlow(
  store: ReviewsStore,
  userId: string | null,
  productId: string,
  input: { question?: unknown }
): Promise<AskQuestionOutcome> {
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };

  const validation = validateQuestionInput(input);
  if (!validation.ok) {
    return { ok: false, code: "INVALID_INPUT", errors: validation.errors };
  }

  const product = await store.findProductById(productId);
  if (!product || product.status !== "ACTIVE") {
    return { ok: false, code: "PRODUCT_NOT_FOUND" };
  }

  try {
    await store.createQuestion({
      productId,
      userId,
      question: validation.data,
      status: "PENDING",
    });
    return { ok: true, status: "PENDING" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export type AnswerQuestionOutcome =
  | { ok: true; questionStatus: "ANSWERED" }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "UNAVAILABLE"; errors?: Record<string, string> };

/**
 * Answer a product question. ADMIN/STAFF only — role comes from the
 * session user row server-side. The staff answer also publishes the
 * question (PENDING → ANSWERED): with the existing QuestionStatus enum,
 * an answered question IS the public/approved state. Answer + publish
 * run as one store-level paired write.
 */
export async function answerQuestionFlow(
  store: ReviewsStore,
  userId: string | null,
  role: string,
  questionId: string,
  input: { answer?: unknown }
): Promise<AnswerQuestionOutcome> {
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };
  if (!canAnswerQuestions(role)) return { ok: false, code: "FORBIDDEN" };

  const validation = validateAnswerInput(input);
  if (!validation.ok) {
    return { ok: false, code: "INVALID_INPUT", errors: validation.errors };
  }

  const question = await store.findQuestionById(questionId);
  if (!question || question.status === "CLOSED") {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    await store.createAnswer({ questionId, userId, answer: validation.data });
    await store.updateQuestionStatus(questionId, "ANSWERED");
    return { ok: true, questionStatus: "ANSWERED" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export type ModerateQuestionOutcome =
  | { ok: true; status: "PENDING" | "ANSWERED" | "CLOSED" }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_TRANSITION" };

/** Set a question's status — ADMIN/STAFF only (future Admin Panel entry). */
export async function moderateQuestionFlow(
  store: ReviewsStore,
  userId: string | null,
  role: string,
  questionId: string,
  to: "PENDING" | "ANSWERED" | "CLOSED"
): Promise<ModerateQuestionOutcome> {
  if (!userId) return { ok: false, code: "UNAUTHENTICATED" };
  if (!canModerateQuestions(role)) return { ok: false, code: "FORBIDDEN" };
  if (!["PENDING", "ANSWERED", "CLOSED"].includes(to)) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }

  const existing = await store.findQuestionById(questionId);
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (existing.status === to) return { ok: true, status: to };

  await store.updateQuestionStatus(questionId, to);
  return { ok: true, status: to };
}
