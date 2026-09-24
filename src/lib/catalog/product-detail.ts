// Product Detail data layer — server-only Prisma access
// Reviews, Q&A and related educational content for the product page.
// Follows the catalog `safe()` pattern: DB failures resolve to empty results.

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ── Reviews ────────────────────────────────────────────────────────────

export type ProductReview = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  authorName: string;
  isVerifiedPurchase: boolean;
};

export type ProductReviewsSummary = {
  items: ProductReview[];
  total: number;
  average: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

// Verified purchase = a paid, non-cancelled order containing this product.
// Server-derived display fact (the submission gate lives in
// src/lib/reviews/service — hasPurchasedProduct). Distinct user ids keep the
// payload bounded: one row per buyer, not one per order.
async function getVerifiedReviewerIds(productId: string): Promise<Set<string>> {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PAID",
      status: { notIn: ["CANCELLED", "RETURNED"] },
      userId: { not: null },
      items: { some: { productId } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(
    orders
      .map((o) => o.userId)
      .filter((id): id is string => id != null)
  );
}

export async function getProductReviews(
  productId: string,
  take = 10
): Promise<ProductReviewsSummary> {
  return safe(
    async () => {
      // One parallel round: the page rows, a DB-side rating histogram (which
      // yields total + average + distribution without fetching every rating
      // row), and the verified-buyer set. Previously the average/distribution
      // came from a SECOND, sequential, unbounded findMany of all ratings.
      const [rows, ratingGroups, verifiedIds] = await Promise.all([
        prisma.review.findMany({
          where: { productId, status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take,
          include: {
            user: {
              select: { firstName: true, lastName: true, displayName: true },
            },
          },
        }),
        prisma.review.groupBy({
          by: ["rating"],
          where: { productId, status: "APPROVED" },
          _count: { _all: true },
        }),
        getVerifiedReviewerIds(productId),
      ]);

      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
      };
      let total = 0;
      let weightedSum = 0;
      for (const g of ratingGroups) {
        const key = g.rating as 1 | 2 | 3 | 4 | 5;
        if (key >= 1 && key <= 5) {
          distribution[key] += g._count._all;
          total += g._count._all;
          weightedSum += g.rating * g._count._all;
        }
      }

      const average = total > 0 ? weightedSum / total : null;

      const items: ProductReview[] = rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        createdAt: r.createdAt,
        authorName:
          r.user.displayName ??
          [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") ??
          "کاربر ریحان",
        isVerifiedPurchase: verifiedIds.has(r.userId),
      }));

      return { items, total, average, distribution };
    },
    { items: [], total: 0, average: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
  );
}

// ── Q&A ────────────────────────────────────────────────────────────────

export type ProductAnswerView = {
  id: string;
  answer: string;
  createdAt: Date;
  authorName: string;
  isStaff: boolean;
};

export type ProductQuestionView = {
  id: string;
  question: string;
  createdAt: Date;
  authorName: string;
  answers: ProductAnswerView[];
};

export async function getProductQuestions(
  productId: string,
  take = 10
): Promise<ProductQuestionView[]> {
  return safe(async () => {
    // Public list = ANSWERED questions only. PENDING questions await a
    // staff answer (their approval to publish); CLOSED stays archived.
    // The filter is server-side — never just hidden in the UI.
    const questions = await prisma.productQuestion.findMany({
      where: { productId, status: "ANSWERED" },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { firstName: true, lastName: true, displayName: true } },
        answers: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { firstName: true, lastName: true, displayName: true, role: true },
            },
          },
        },
      },
    });

    return questions.map((q) => ({
      id: q.id,
      question: q.question,
      createdAt: q.createdAt,
      authorName:
        q.user.displayName ??
        [q.user.firstName, q.user.lastName].filter(Boolean).join(" ") ??
        "کاربر ریحان",
      answers: q.answers.map((a) => ({
        id: a.id,
        answer: a.answer,
        createdAt: a.createdAt,
        authorName:
          a.user.displayName ??
          [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ??
          "کاربر ریحان",
        isStaff: a.user.role === "ADMIN" || a.user.role === "STAFF",
      })),
    }));
  }, []);
}

// ── Related educational content (blog posts) ───────────────────────────

export type RelatedPostView = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
};

// Link posts to a product via keyword overlap between post title/excerpt
// and the product title/category names — no new DB relations needed.
export async function getRelatedPostsForProduct(
  productTitle: string,
  categoryNames: string[],
  take = 3
): Promise<RelatedPostView[]> {
  return safe(async () => {
    const terms = Array.from(
      new Set(
        [productTitle, ...categoryNames]
          .join(" ")
          .split(/[\s‌،,؛;]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3)
      )
    ).slice(0, 12);

    if (terms.length === 0) return [];

    const orFilters: Prisma.PostWhereInput[] = terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { excerpt: { contains: term, mode: "insensitive" } },
      ],
    }));

    const posts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        OR: orFilters,
      },
      orderBy: { publishedAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
      },
    });

    return posts;
  }, []);
}
