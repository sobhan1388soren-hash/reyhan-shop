// Review moderation administration — server-only read queries. Phase 14,
// Part 2.
//
// Reads are display-only and expose safe facts (product, reviewer display
// name/phone, rating, text, status, date). Moderation itself is delegated
// to the existing reviews service (moderateReview) — no rule is re-declared
// here.

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";

export type AdminReviewFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: ReviewStatus;
};

export type AdminReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  createdAt: Date;
  product: { id: string; title: string; slug: string } | null;
  reviewer: { id: string; name: string; phone: string } | null;
};

export type AdminReviewListResult =
  | { state: "ok"; rows: AdminReviewRow[]; meta: PaginationMeta }
  | { state: "error" };

export async function getAdminReviews(
  filters: AdminReviewFilters
): Promise<AdminReviewListResult> {
  try {
    const where: Prisma.ReviewWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: "insensitive" } },
        { comment: { contains: filters.q, mode: "insensitive" } },
        { product: { title: { contains: filters.q, mode: "insensitive" } } },
        {
          user: {
            OR: [
              { firstName: { contains: filters.q, mode: "insensitive" } },
              { lastName: { contains: filters.q, mode: "insensitive" } },
              { displayName: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q } },
            ],
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          status: true,
          createdAt: true,
          product: { select: { id: true, title: true, slug: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        product: r.product,
        reviewer: r.user
          ? {
              id: r.user.id,
              name:
                r.user.displayName?.trim() ||
                [r.user.firstName?.trim(), r.user.lastName?.trim()].filter(Boolean).join(" ") ||
                "کاربر ریحان",
              phone: r.user.phone,
            }
          : null,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminReviewStatusCounts = Record<ReviewStatus, number>;

export type AdminReviewCountsResult =
  | { state: "ok"; counts: AdminReviewStatusCounts }
  | { state: "error" };

/** Moderation queue counters (real rows only). */
export async function getAdminReviewCounts(): Promise<AdminReviewCountsResult> {
  try {
    const grouped = await prisma.review.groupBy({ by: ["status"], _count: { _all: true } });
    const counts: AdminReviewStatusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;
    return { state: "ok", counts };
  } catch {
    return { state: "error" };
  }
}