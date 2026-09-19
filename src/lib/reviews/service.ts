// Reviews & Q&A service — server-only Prisma adapter for the pure
// reviews domain flows (./rules), plus display-context queries.
//
// Security model (mirrors auth/account + payments conventions):
//   - every mutation re-derives the user from the signed session via the
//     DAL; ids from the request are never trusted for identity
//   - verified-purchaser status is computed HERE from Order/OrderItem
//     rows (paid, non-cancelled order containing the product); client
//     flags never enter this module
//   - moderation (approve/reject review, close question) requires
//     ADMIN/STAFF role resolved from the session user row
//   - answering questions requires ADMIN/STAFF; an ordinary user can
//     never create an answer, whatever the client sends
//   - public display queries filter by status server-side (APPROVED
//     reviews only; ANSWERED questions only) — hiding UI is never the
//     only guard
//
// All authorization decisions live in ./rules (pure, unit-tested); this
// file only adapts them to Prisma.

import "server-only";
import prisma from "@/lib/prisma";
import type { ReviewsStore, StoreOrderRow } from "./rules.ts";
import {
  submitReviewFlow,
  moderateReviewFlow,
  askQuestionFlow,
  answerQuestionFlow,
  moderateQuestionFlow,
} from "./rules.ts";

// ── Prisma store adapter ───────────────────────────────────────────────

export const prismaReviewsStore: ReviewsStore = {
  async findProductById(productId) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, status: true },
      });
      return product;
    } catch {
      return null;
    }
  },

  async findReviewByProductAndUser(productId, userId) {
    try {
      return await prisma.review.findFirst({
        where: { productId, userId },
        select: { id: true, productId: true, userId: true, status: true },
      });
    } catch {
      return null;
    }
  },

  async findReviewById(reviewId) {
    try {
      return await prisma.review.findUnique({
        where: { id: reviewId },
        select: { id: true, productId: true, userId: true, status: true },
      });
    } catch {
      return null;
    }
  },

  async listOrdersForUser(userId) {
    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        select: {
          userId: true,
          paymentStatus: true,
          status: true,
          items: { select: { productId: true } },
        },
      });
      return orders.map((o) => ({
        userId: o.userId,
        paymentStatus: o.paymentStatus,
        status: o.status,
        productIds: o.items.map((i) => i.productId),
      })) satisfies StoreOrderRow[];
    } catch {
      return [];
    }
  },

  async createReview(input) {
    return prisma.review.create({
      data: {
        productId: input.productId,
        userId: input.userId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        status: "PENDING",
      },
      select: { id: true },
    });
  },

  async updateReviewStatus(reviewId, status) {
    await prisma.review.update({
      where: { id: reviewId },
      data: { status: status as "PENDING" | "APPROVED" | "REJECTED" },
      select: { id: true },
    });
  },

  async findQuestionById(questionId) {
    try {
      return await prisma.productQuestion.findUnique({
        where: { id: questionId },
        select: { id: true, productId: true, userId: true, status: true },
      });
    } catch {
      return null;
    }
  },

  async createQuestion(input) {
    return prisma.productQuestion.create({
      data: {
        productId: input.productId,
        userId: input.userId,
        question: input.question,
        status: "PENDING",
      },
      select: { id: true },
    });
  },

  async createAnswer(input) {
    // Answer + publish (PENDING→ANSWERED) in ONE transaction — a public
    // ANSWERED question must never exist without its staff answer.
    return prisma.$transaction(async (tx) => {
      const answer = await tx.productAnswer.create({
        data: { questionId: input.questionId, userId: input.userId, answer: input.answer },
        select: { id: true },
      });
      await tx.productQuestion.update({
        where: { id: input.questionId },
        data: { status: "ANSWERED" },
        select: { id: true },
      });
      return answer;
    });
  },

  async updateQuestionStatus(questionId, status) {
    await prisma.productQuestion.update({
      where: { id: questionId },
      data: { status: status as "PENDING" | "ANSWERED" | "CLOSED" },
      select: { id: true },
    });
  },
};

// ── Verified purchaser (server-side fact from order data) ──────────────

/**
 * Whether the user has actually purchased the product: at least one
 * PAID, non-cancelled order of this user containing the product as an
 * item. Derived exclusively from DB rows — never from client input.
 */
export async function hasPurchasedProduct(
  userId: string,
  productId: string
): Promise<boolean> {
  try {
    const count = await prisma.order.count({
      where: {
        userId,
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "RETURNED"] },
        items: { some: { productId } },
      },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/** Product page display: ids of users with a verified purchase. */
export async function getVerifiedPurchaserUserIds(
  productId: string
): Promise<Set<string>> {
  try {
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "RETURNED"] },
        userId: { not: null },
        items: { some: { productId } },
      },
      select: { userId: true },
    });
    return new Set(
      orders.map((o) => o.userId).filter((id): id is string => id != null)
    );
  } catch {
    return new Set();
  }
}

/**
 * Product-page context for the review form: whether the session user may
 * submit a review right now (authenticated + purchased + no review yet).
 * Derived entirely server-side; used only to pick which form state the
 * UI renders — the action re-verifies everything anyway.
 */
export async function getReviewFormContext(
  userId: string | null,
  productId: string
): Promise<{ canReview: boolean }> {
  if (!userId) return { canReview: false };
  try {
    const [purchased, existing] = await Promise.all([
      hasPurchasedProduct(userId, productId),
      prisma.review.findFirst({
        where: { productId, userId },
        select: { id: true },
      }),
    ]);
    return { canReview: purchased && !existing };
  } catch {
    return { canReview: false };
  }
}

// ── Public service API (server actions / future Admin Panel) ───────────

export type SubmitReviewResult = Awaited<ReturnType<typeof submitReviewFlow>>;
export type ModerateReviewResult = Awaited<ReturnType<typeof moderateReviewFlow>>;
export type AskQuestionResult = Awaited<ReturnType<typeof askQuestionFlow>>;
export type AnswerQuestionResult = Awaited<ReturnType<typeof answerQuestionFlow>>;
export type ModerateQuestionResult = Awaited<ReturnType<typeof moderateQuestionFlow>>;

export async function submitReview(
  userId: string | null,
  productId: string,
  input: { rating?: unknown; title?: unknown; comment?: unknown }
): Promise<SubmitReviewResult> {
  return submitReviewFlow(prismaReviewsStore, userId, productId, input);
}

export async function moderateReview(
  userId: string | null,
  role: string,
  reviewId: string,
  to: "PENDING" | "APPROVED" | "REJECTED"
): Promise<ModerateReviewResult> {
  return moderateReviewFlow(prismaReviewsStore, userId, role, reviewId, to);
}

export async function askProductQuestion(
  userId: string | null,
  productId: string,
  input: { question?: unknown }
): Promise<AskQuestionResult> {
  return askQuestionFlow(prismaReviewsStore, userId, productId, input);
}

export async function answerProductQuestion(
  userId: string | null,
  role: string,
  questionId: string,
  input: { answer?: unknown }
): Promise<AnswerQuestionResult> {
  return answerQuestionFlow(prismaReviewsStore, userId, role, questionId, input);
}

export async function moderateProductQuestion(
  userId: string | null,
  role: string,
  questionId: string,
  to: "PENDING" | "ANSWERED" | "CLOSED"
): Promise<ModerateQuestionResult> {
  return moderateQuestionFlow(prismaReviewsStore, userId, role, questionId, to);
}
