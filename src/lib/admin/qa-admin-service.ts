// Product Q&A administration — server-only read queries. Phase 14, Part 2.
//
// Reads are display-only and expose safe facts (product, asker, question,
// status, answers with staff flag). Answering/closing is delegated to the
// existing reviews service (answerProductQuestion / moderateProductQuestion).

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, QuestionStatus } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";

export type AdminQuestionFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: QuestionStatus;
};

export type AdminQuestionAnswer = {
  id: string;
  answer: string;
  createdAt: Date;
  authorName: string;
  isStaff: boolean;
};

export type AdminQuestionRow = {
  id: string;
  question: string;
  status: QuestionStatus;
  createdAt: Date;
  product: { id: string; title: string; slug: string } | null;
  asker: { id: string; name: string; phone: string } | null;
  answers: AdminQuestionAnswer[];
  answerCount: number;
};

export type AdminQuestionListResult =
  | { state: "ok"; rows: AdminQuestionRow[]; meta: PaginationMeta }
  | { state: "error" };

export async function getAdminQuestions(
  filters: AdminQuestionFilters
): Promise<AdminQuestionListResult> {
  try {
    const where: Prisma.ProductQuestionWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      where.OR = [
        { question: { contains: filters.q, mode: "insensitive" } },
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
      prisma.productQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        select: {
          id: true,
          question: true,
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
          _count: { select: { answers: true } },
          answers: {
            orderBy: { createdAt: "asc" },
            take: 3,
            select: {
              id: true,
              answer: true,
              createdAt: true,
              user: {
                select: {
                  role: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      prisma.productQuestion.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((q) => ({
        id: q.id,
        question: q.question,
        status: q.status,
        createdAt: q.createdAt,
        product: q.product,
        asker: q.user
          ? {
              id: q.user.id,
              name:
                q.user.displayName?.trim() ||
                [q.user.firstName?.trim(), q.user.lastName?.trim()].filter(Boolean).join(" ") ||
                "کاربر ریحان",
              phone: q.user.phone,
            }
          : null,
        answerCount: q._count.answers,
        answers: q.answers.map((a) => ({
          id: a.id,
          answer: a.answer,
          createdAt: a.createdAt,
          authorName:
            a.user.displayName?.trim() ||
            [a.user.firstName?.trim(), a.user.lastName?.trim()].filter(Boolean).join(" ") ||
            "کاربر ریحان",
          isStaff: a.user.role === "ADMIN" || a.user.role === "STAFF",
        })),
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminQuestionStatusCounts = Record<QuestionStatus, number>;

export type AdminQuestionCountsResult =
  | { state: "ok"; counts: AdminQuestionStatusCounts }
  | { state: "error" };

/** Q&A queue counters (real rows only). */
export async function getAdminQuestionCounts(): Promise<AdminQuestionCountsResult> {
  try {
    const grouped = await prisma.productQuestion.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts: AdminQuestionStatusCounts = { PENDING: 0, ANSWERED: 0, CLOSED: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;
    return { state: "ok", counts };
  } catch {
    return { state: "error" };
  }
}