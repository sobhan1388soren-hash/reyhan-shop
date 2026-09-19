// Unit tests — Reviews & Product Q&A domain (Phase 11).
// Pure logic only, DB-free: the service functions run against an
// in-memory store fake that mirrors the Prisma query semantics used by
// the real service (ownership-scoped reads, guarded writes, role checks).
//
// Run: node --test src/lib/reviews/reviews.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateReviewInput,
  isValidRating,
  canModerateReview,
  canAnswerQuestions,
  canModerateQuestions,
  validateQuestionInput,
  validateAnswerInput,
  isPubliclyVisibleQuestion,
  isPubliclyVisibleReview,
  hasPurchasedProductIn,
  isPurchaseOrderStatus,
  submitReviewFlow,
  moderateReviewFlow,
  askQuestionFlow,
  answerQuestionFlow,
  moderateQuestionFlow,
  MIN_RATING,
  MAX_RATING,
  REVIEW_TITLE_MAX,
  REVIEW_COMMENT_MAX,
  QUESTION_MAX,
  ANSWER_MAX,
} from "./rules.ts";

// ── Review validation ──────────────────────────────────────────────────

test("review: valid rating is an integer 1-5", () => {
  for (const r of [1, 2, 3, 4, 5]) assert.ok(isValidRating(r));
  assert.equal(isValidRating(0), false);
  assert.equal(isValidRating(6), false);
  assert.equal(isValidRating(3.5), false, "fractional ratings rejected");
  assert.equal(isValidRating("5"), false, "no string coercion");
  assert.equal(isValidRating(null), false);
  assert.equal(isValidRating(Number.NaN), false);
});

test("review: full valid input passes", () => {
  const out = validateReviewInput({
    rating: 4,
    title: "کیفت خوب",
    comment: "بعد از یک ماه استفاده، کیفیت آب بهتر شد.",
  });
  assert.ok(out.ok);
  assert.equal(out.data.rating, 4);
  assert.equal(out.data.title, "کیفت خوب");
});

test("review: comment-only and title-only reviews pass; empty text is rejected", () => {
  const commentOnly = validateReviewInput({ rating: 5, comment: "خیلی خوب بود." });
  assert.ok(commentOnly.ok);

  const titleOnly = validateReviewInput({ rating: 3, title: "متوسط" });
  assert.ok(titleOnly.ok);

  const noText = validateReviewInput({ rating: 3 });
  assert.equal(noText.ok, false);
  assert.ok(noText.errors.comment);
});

test("review: invalid ratings are rejected with a Persian message", () => {
  for (const rating of [0, 6, -1, 2.5, "4", null]) {
    const out = validateReviewInput({ rating, comment: "متن معتبر دیدگاه." });
    assert.equal(out.ok, false, `rating=${rating} must fail`);
    assert.ok(out.errors.rating.includes("امتیاز"));
  }
});

test("review: length bounds are enforced", () => {
  const tooLongTitle = validateReviewInput({
    rating: 4,
    title: "x".repeat(REVIEW_TITLE_MAX + 1),
    comment: "متن معتبر.",
  });
  assert.equal(tooLongTitle.ok, false);
  assert.ok(tooLongTitle.errors.title);

  const tooShortComment = validateReviewInput({
    rating: 4,
    comment: "ک",
  });
  assert.equal(tooShortComment.ok, false);
  assert.ok(tooShortComment.errors.comment);

  const tooLongComment = validateReviewInput({
    rating: 4,
    comment: "م".repeat(REVIEW_COMMENT_MAX + 1),
  });
  assert.equal(tooLongComment.ok, false);
  assert.ok(tooLongComment.errors.comment);
});

test("review: hostile/non-string input never passes validation", () => {
  const hostile = validateReviewInput({
    rating: { malicious: true },
    title: { toString: () => "x" },
    comment: ["array"],
  });
  assert.equal(hostile.ok, false);
});

// ── Q&A validation ──────────────────────────────────────────────────────

test("question: valid 5-500 char questions pass; others fail", () => {
  const ok = validateQuestionInput({ question: "این دستگاه برای آب شهری مناسب است؟" });
  assert.ok(ok.ok);
  assert.equal(ok.data, "این دستگاه برای آب شهری مناسب است؟");

  assert.equal(validateQuestionInput({ question: "سؤال" }).ok, false, "too short");
  assert.equal(validateQuestionInput({ question: "س".repeat(QUESTION_MAX + 1) }).ok, false);
  assert.equal(validateQuestionInput({ question: "" }).ok, false);
  assert.equal(validateQuestionInput({ question: null }).ok, false);
  assert.equal(validateQuestionInput({}).ok, false);
  // Trimming: padded input normalizes.
  const trimmed = validateQuestionInput({ question: "  این یک سؤال معتبر است؟  " });
  assert.ok(trimmed.ok);
  assert.equal(trimmed.data, "این یک سؤال معتبر است؟");
});

test("answer: valid 2-2000 char answers pass; others fail", () => {
  assert.ok(validateAnswerInput({ answer: "بله، مناسب است." }).ok);
  assert.equal(validateAnswerInput({ answer: "ب" }).ok, false, "too short");
  assert.equal(validateAnswerInput({ answer: "م".repeat(ANSWER_MAX + 1) }).ok, false);
  assert.equal(validateAnswerInput({ answer: "" }).ok, false);
  assert.equal(validateAnswerInput({ question: "نادرست" }).ok, false);
});

// ── Authorization rules ────────────────────────────────────────────────

test("authorization: only ADMIN/STAFF may moderate reviews, answer, or close questions", () => {
  assert.ok(canModerateReview("ADMIN"));
  assert.ok(canModerateReview("STAFF"));
  assert.equal(canModerateReview("CUSTOMER"), false);
  assert.equal(canModerateReview(""), false);

  assert.ok(canAnswerQuestions("ADMIN"));
  assert.ok(canAnswerQuestions("STAFF"));
  assert.equal(canAnswerQuestions("CUSTOMER"), false, "ordinary users can never answer");

  assert.ok(canModerateQuestions("ADMIN"));
  assert.ok(canModerateQuestions("STAFF"));
  assert.equal(canModerateQuestions("CUSTOMER"), false);
});

// ── Public visibility rules ────────────────────────────────────────────

test("visibility: only ANSWERED questions are public; PENDING/CLOSED are not", () => {
  assert.ok(isPubliclyVisibleQuestion("ANSWERED"));
  assert.equal(isPubliclyVisibleQuestion("PENDING"), false);
  assert.equal(isPubliclyVisibleQuestion("CLOSED"), false);
  assert.equal(isPubliclyVisibleQuestion("APPROVED"), false);
  assert.equal(isPubliclyVisibleQuestion(""), false);
});

test("purchase statuses: active fulfillment chain counts; terminal negatives do not", () => {
  for (const s of ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
    assert.ok(isPurchaseOrderStatus(s), `${s} is a genuine purchase`);
  }
  assert.equal(isPurchaseOrderStatus("CANCELLED"), false);
  assert.equal(isPurchaseOrderStatus("RETURNED"), false);
});

test("bounds: constants are sane", () => {
  assert.equal(MIN_RATING, 1);
  assert.equal(MAX_RATING, 5);
});

// ── Shared fixtures for flow tests ─────────────────────────────────────

const USER_A = "user_aaaaaaaaaaaaaaaaaaaa";
const USER_B = "user_bbbbbbbbbbbbbbbbbb";
const STAFF = "user_staffaaaaaaaaaaaaaaaaa".slice(0, 24);
const PRODUCT_1 = "prod_aaaaaaaaaaaaaaaaaa";
const PRODUCT_2 = "prod_bbbbbbbbbbbbbbbbbb";
const REVIEW_ID = "revi_aaaaaaaaaaaaaaaaaa";
const QUESTION_ID = "ques_aaaaaaaaaaaaaaaaaa";

const VALID_REVIEW = { rating: 5, comment: "کیافت عالی؛ آب شهری را کامل تصفیه کرد." };
const VALID_QUESTION = { question: "این دستگاه برای آب شهری مناسب است؟" };
const VALID_ANSWER = { answer: "بله، برای آب شهری کاملاً مناسب است." };

/**
 * In-memory store mirroring the Prisma adapter semantics. Seeded with:
 *   - USER_A purchased PRODUCT_1 (PAID/DELIVERED order containing it)
 *   - USER_B purchased nothing
 */
function makeFakeStore(overrides = {}) {
  const products = [
    { id: PRODUCT_1, status: "ACTIVE" },
    { id: PRODUCT_2, status: "ACTIVE" },
    ...(overrides.products ?? []),
  ];
  const orders = overrides.orders ?? [
    {
      userId: USER_A,
      paymentStatus: "PAID",
      status: "DELIVERED",
      productIds: [PRODUCT_1],
    },
  ];
  const reviews = [...(overrides.reviews ?? [])];
  const questions = [...(overrides.questions ?? [])];
  const answers = [];
  const log = [];
  let seq = 1;

  return {
    log,
    reviews: () => reviews,
    questions: () => questions,
    answers: () => answers,
    async findProductById(id) {
      return products.find((p) => p.id === id) ?? null;
    },
    async findReviewByProductAndUser(productId, userId) {
      return (
        reviews.find((r) => r.productId === productId && r.userId === userId) ?? null
      );
    },
    async findReviewById(id) {
      return reviews.find((r) => r.id === id) ?? null;
    },
    async listOrdersForUser(userId) {
      return orders.filter((o) => o.userId === userId);
    },
    async createReview(input) {
      const row = {
        id: `revi_new${seq++}`.padEnd(20, "0"),
        productId: input.productId,
        userId: input.userId,
        status: input.status,
        rating: input.rating,
      };
      reviews.push(row);
      log.push({ op: "review-create", status: input.status });
      return { id: row.id };
    },
    async updateReviewStatus(id, status) {
      const row = reviews.find((r) => r.id === id);
      if (row) row.status = status;
      log.push({ op: "review-status", id, status });
    },
    async findQuestionById(id) {
      return questions.find((q) => q.id === id) ?? null;
    },
    async createQuestion(input) {
      const row = {
        id: `ques_new${seq++}`.padEnd(20, "0"),
        productId: input.productId,
        userId: input.userId,
        status: input.status,
      };
      questions.push(row);
      log.push({ op: "question-create", status: input.status });
      return { id: row.id };
    },
    async createAnswer(input) {
      const row = { id: `answ_new${seq++}`.padEnd(20, "0"), ...input };
      answers.push(row);
      log.push({ op: "answer-create", questionId: input.questionId });
      return { id: row.id };
    },
    async updateQuestionStatus(id, status) {
      const row = questions.find((q) => q.id === id);
      if (row) row.status = status;
      log.push({ op: "question-status", id, status });
    },
  };
}

// ── Review submission flow ─────────────────────────────────────────────

test("flow: authenticated verified purchaser can submit a review (lands PENDING)", async () => {
  const store = makeFakeStore();
  const out = await submitReviewFlow(store, USER_A, PRODUCT_1, VALID_REVIEW);
  assert.ok(out.ok);
  assert.equal(out.status, "PENDING");
  assert.equal(store.reviews().length, 1);
  assert.equal(store.reviews()[0].status, "PENDING", "never auto-approved");
  assert.equal(store.reviews()[0].userId, USER_A);
});

test("flow: unauthenticated user cannot submit a review", async () => {
  const store = makeFakeStore();
  const out = await submitReviewFlow(store, null, PRODUCT_1, VALID_REVIEW);
  assert.equal(out.ok, false);
  assert.equal(out.code, "UNAUTHENTICATED");
  assert.equal(store.reviews().length, 0);
});

test("flow: purchaser of ANOTHER product cannot review this one", async () => {
  const store = makeFakeStore();
  const out = await submitReviewFlow(store, USER_A, PRODUCT_2, VALID_REVIEW);
  assert.equal(out.ok, false);
  assert.equal(out.code, "NOT_VERIFIED_PURCHASER");
  assert.equal(store.reviews().length, 0);
});

test("flow: non-purchaser cannot submit a review", async () => {
  const store = makeFakeStore();
  const out = await submitReviewFlow(store, USER_B, PRODUCT_1, VALID_REVIEW);
  assert.equal(out.ok, false);
  assert.equal(out.code, "NOT_VERIFIED_PURCHASER");
  assert.equal(store.reviews().length, 0);
});

test("flow: unpaid or cancelled orders do not count as purchases", async () => {
  // paymentStatus PENDING (never paid) — not a purchase.
  const unpaid = makeFakeStore({
    orders: [{ userId: USER_A, paymentStatus: "PENDING", status: "DELIVERED", productIds: [PRODUCT_1] }],
  });
  assert.equal(
    (await submitReviewFlow(unpaid, USER_A, PRODUCT_1, VALID_REVIEW)).code,
    "NOT_VERIFIED_PURCHASER",
    "unpaid order never verifies a purchase"
  );

  // Cancelled order — not a purchase.
  const cancelled = makeFakeStore({
    orders: [{ userId: USER_A, paymentStatus: "PAID", status: "CANCELLED", productIds: [PRODUCT_1] }],
  });
  assert.equal(
    (await submitReviewFlow(cancelled, USER_A, PRODUCT_1, VALID_REVIEW)).code,
    "NOT_VERIFIED_PURCHASER",
    "cancelled order never verifies a purchase"
  );

  // Paid + still-active order (PENDING fulfillment) — IS a purchase.
  const active = makeFakeStore({
    orders: [{ userId: USER_A, paymentStatus: "PAID", status: "PENDING", productIds: [PRODUCT_1] }],
  });
  const ok = await submitReviewFlow(active, USER_A, PRODUCT_1, VALID_REVIEW);
  assert.ok(ok.ok, "paid active order verifies the purchase");
});

test("flow: invalid rating/content rejected before any write", async () => {
  const store = makeFakeStore();
  const badRating = await submitReviewFlow(store, USER_A, PRODUCT_1, { rating: 9, comment: "متن معتبر." });
  assert.equal(badRating.ok, false);
  assert.equal(badRating.code, "INVALID_INPUT");
  assert.ok(badRating.errors.rating);

  const noText = await submitReviewFlow(store, USER_A, PRODUCT_1, { rating: 3 });
  assert.equal(noText.code, "INVALID_INPUT");

  assert.equal(store.reviews().length, 0, "nothing written on invalid input");
});

test("flow: second review for the same product by the same user is refused", async () => {
  const store = makeFakeStore();
  await submitReviewFlow(store, USER_A, PRODUCT_1, VALID_REVIEW);
  const second = await submitReviewFlow(store, USER_A, PRODUCT_1, {
    rating: 1,
    comment: "دیدگاه دوم برای همین محصول.",
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, "ALREADY_REVIEWED");
  assert.equal(store.reviews().length, 1);
});

test("flow: unknown or inactive product is rejected", async () => {
  const store = makeFakeStore({
    products: [{ id: "prod_draftaaaaaaaaaaaaaaa", status: "DRAFT" }],
  });
  const unknown = await submitReviewFlow(store, USER_A, "prod_unknown00000000", VALID_REVIEW);
  assert.equal(unknown.code, "PRODUCT_NOT_FOUND");

  const draft = await submitReviewFlow(store, USER_A, "prod_draftaaaaaaaaaaaaaaa", VALID_REVIEW);
  assert.equal(draft.code, "PRODUCT_NOT_FOUND");
});

test("flow: a client cannot smuggle a status past the flow", async () => {
  const store = makeFakeStore();
  // Even hostile "status" input is ignored — the flow hardcodes PENDING.
  const out = await submitReviewFlow(store, USER_A, PRODUCT_1, {
    ...VALID_REVIEW,
    status: "APPROVED",
  });
  assert.ok(out.ok);
  assert.equal(store.reviews()[0].status, "PENDING");
});

// ── Review moderation flow ────────────────────────────────────────────

test("flow: ordinary user cannot moderate reviews", async () => {
  const store = makeFakeStore({
    reviews: [{ id: REVIEW_ID, productId: PRODUCT_1, userId: USER_A, status: "PENDING" }],
  });
  const out = await moderateReviewFlow(store, USER_A, "CUSTOMER", REVIEW_ID, "APPROVED");
  assert.equal(out.ok, false);
  assert.equal(out.code, "FORBIDDEN");
  assert.equal(store.reviews()[0].status, "PENDING", "no self-approval");
});

test("flow: unauthenticated caller cannot moderate reviews", async () => {
  const store = makeFakeStore({
    reviews: [{ id: REVIEW_ID, productId: PRODUCT_1, userId: USER_A, status: "PENDING" }],
  });
  const out = await moderateReviewFlow(store, null, "ADMIN", REVIEW_ID, "APPROVED");
  assert.equal(out.code, "UNAUTHENTICATED");
  assert.equal(store.reviews()[0].status, "PENDING");
});

test("flow: staff can approve and reject; approved becomes public", async () => {
  const store = makeFakeStore({
    reviews: [{ id: REVIEW_ID, productId: PRODUCT_1, userId: USER_A, status: "PENDING" }],
  });
  const approve = await moderateReviewFlow(store, STAFF, "STAFF", REVIEW_ID, "APPROVED");
  assert.ok(approve.ok);
  assert.equal(approve.status, "APPROVED");
  assert.equal(isPubliclyVisibleReview(store.reviews()[0].status), true);

  const reject = await moderateReviewFlow(store, STAFF, "ADMIN", REVIEW_ID, "REJECTED");
  assert.ok(reject.ok);
  assert.equal(isPubliclyVisibleReview(store.reviews()[0].status), false);
});

test("flow: moderating a missing review is NOT_FOUND", async () => {
  const store = makeFakeStore();
  const out = await moderateReviewFlow(store, STAFF, "ADMIN", "revi_missing0000000", "APPROVED");
  assert.equal(out.code, "NOT_FOUND");
});

// ── Public visibility of reviews ───────────────────────────────────────

test("visibility: only APPROVED reviews are public; PENDING/REJECTED are not", () => {
  assert.ok(isPubliclyVisibleReview("APPROVED"));
  assert.equal(isPubliclyVisibleReview("PENDING"), false);
  assert.equal(isPubliclyVisibleReview("REJECTED"), false);
});

// ── Question flow ──────────────────────────────────────────────────────

test("flow: unauthenticated user cannot ask a question", async () => {
  const store = makeFakeStore();
  const out = await askQuestionFlow(store, null, PRODUCT_1, VALID_QUESTION);
  assert.equal(out.ok, false);
  assert.equal(out.code, "UNAUTHENTICATED");
  assert.equal(store.questions().length, 0);
});

test("flow: authenticated user can ask; question lands PENDING (not public)", async () => {
  const store = makeFakeStore();
  const out = await askQuestionFlow(store, USER_B, PRODUCT_1, VALID_QUESTION);
  assert.ok(out.ok);
  assert.equal(out.status, "PENDING");
  const row = store.questions()[0];
  assert.equal(row.status, "PENDING");
  assert.equal(isPubliclyVisibleQuestion(row.status), false, "pending is private");
});

test("flow: invalid question content rejected before any write", async () => {
  const store = makeFakeStore();
  const short = await askQuestionFlow(store, USER_A, PRODUCT_1, { question: "چرا؟" });
  assert.equal(short.code, "INVALID_INPUT");
  const long = await askQuestionFlow(store, USER_A, PRODUCT_1, {
    question: "س".repeat(QUESTION_MAX + 1),
  });
  assert.equal(long.code, "INVALID_INPUT");
  const hostile = await askQuestionFlow(store, USER_A, PRODUCT_1, { question: { x: 1 } });
  assert.equal(hostile.code, "INVALID_INPUT");
  assert.equal(store.questions().length, 0);
});

test("flow: question for unknown product is rejected", async () => {
  const store = makeFakeStore();
  const out = await askQuestionFlow(store, USER_A, "prod_unknown00000000", VALID_QUESTION);
  assert.equal(out.code, "PRODUCT_NOT_FOUND");
});

// ── Answer flow ────────────────────────────────────────────────────────

test("flow: ordinary user cannot answer a question", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "PENDING" }],
  });
  const out = await answerQuestionFlow(store, USER_A, "CUSTOMER", QUESTION_ID, VALID_ANSWER);
  assert.equal(out.ok, false);
  assert.equal(out.code, "FORBIDDEN");
  assert.equal(store.answers().length, 0, "no answer created");
  assert.equal(store.questions()[0].status, "PENDING", "question not published");
});

test("flow: unauthenticated caller cannot answer", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "PENDING" }],
  });
  const out = await answerQuestionFlow(store, null, "ADMIN", QUESTION_ID, VALID_ANSWER);
  assert.equal(out.code, "UNAUTHENTICATED");
  assert.equal(store.answers().length, 0);
});

test("flow: admin/staff can answer; answer publishes the question (ANSWERED)", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "PENDING" }],
  });
  const out = await answerQuestionFlow(store, STAFF, "STAFF", QUESTION_ID, VALID_ANSWER);
  assert.ok(out.ok);
  assert.equal(out.questionStatus, "ANSWERED");
  assert.equal(store.answers().length, 1);
  assert.equal(store.answers()[0].userId, STAFF, "answer attributed to the staff user");
  assert.equal(isPubliclyVisibleQuestion(store.questions()[0].status), true);
});

test("flow: answering a CLOSED question is refused", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "CLOSED" }],
  });
  const out = await answerQuestionFlow(store, STAFF, "ADMIN", QUESTION_ID, VALID_ANSWER);
  assert.equal(out.code, "NOT_FOUND");
  assert.equal(store.answers().length, 0);
});

test("flow: invalid answer content rejected", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "PENDING" }],
  });
  const out = await answerQuestionFlow(store, STAFF, "ADMIN", QUESTION_ID, { answer: "ب" });
  assert.equal(out.code, "INVALID_INPUT");
  assert.equal(store.answers().length, 0);
});

// ── Question moderation flow ───────────────────────────────────────────

test("flow: ordinary user cannot close/reopen questions", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "ANSWERED" }],
  });
  const out = await moderateQuestionFlow(store, USER_B, "CUSTOMER", QUESTION_ID, "CLOSED");
  assert.equal(out.code, "FORBIDDEN");
  assert.equal(store.questions()[0].status, "ANSWERED");
});

test("flow: staff can close an answered question (removes it from public)", async () => {
  const store = makeFakeStore({
    questions: [{ id: QUESTION_ID, productId: PRODUCT_1, userId: USER_B, status: "ANSWERED" }],
  });
  const out = await moderateQuestionFlow(store, STAFF, "STAFF", QUESTION_ID, "CLOSED");
  assert.ok(out.ok);
  assert.equal(store.questions()[0].status, "CLOSED");
  assert.equal(isPubliclyVisibleQuestion("CLOSED"), false);
});

// ── Verified-purchase rule (pure) ──────────────────────────────────────

test("purchase rule: matches user + product + paid + non-terminal", () => {
  const orders = [
    { userId: USER_A, paymentStatus: "PAID", status: "DELIVERED", productIds: [PRODUCT_1] },
    { userId: USER_B, paymentStatus: "PAID", status: "PENDING", productIds: [PRODUCT_2] },
  ];
  assert.ok(hasPurchasedProductIn(orders, USER_A, PRODUCT_1));
  assert.equal(hasPurchasedProductIn(orders, USER_A, PRODUCT_2), false, "wrong product");
  assert.equal(hasPurchasedProductIn(orders, USER_B, PRODUCT_1), false, "wrong user");
});
