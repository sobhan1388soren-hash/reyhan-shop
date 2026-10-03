// Public blog read queries — Phase 15.
//
// No admin gate and no "server-only": these run in server components only
// (they touch Prisma) but stay importable by any server module. Failures
// degrade to empty results via the shared `safe()` wrapper so an
// unreachable database never takes the storefront down — the same
// convention as the catalog queries. No fake content is ever substituted.
//
// Visibility rule: only PUBLISHED posts and ACTIVE blog categories are
// returned here. Drafts and archived posts are invisible to the public
// site (draft preview happens only inside the admin console).

import { cache } from "react";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PaginatedResult, PaginationMeta } from "@/lib/catalog/types";
import { parsePagination, buildPaginationMeta } from "@/lib/catalog/pagination";
import { renderPostContent, estimateReadingMinutes } from "./content.ts";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[blog] DB query failed; returning fallback:", e);
    return fallback;
  }
}

// ── View shapes ────────────────────────────────────────────────────────

export type BlogPostCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  categories: { id: string; name: string; slug: string }[];
  authorName: string | null;
};

export type BlogCategoryView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  children: BlogCategoryView[];
  postCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type BlogArticle = BlogPostCard & {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  coverImage: string | null;
  updatedAt: Date;
  relatedProducts: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    image: string | null;
    priceMin: number | null;
  }[];
};

function authorName(user: {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string;
} | null): string | null {
  if (!user) return null;
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    null
  );
}

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
  content: true,
  author: { select: { firstName: true, lastName: true, displayName: true, phone: true } },
  categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.PostSelect;

function toCard(p: Prisma.PostGetPayload<{ select: typeof cardSelect }>): BlogPostCard {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    publishedAt: p.publishedAt,
    readingMinutes: estimateReadingMinutes(p.content),
    categories: p.categories.map((c) => c.category),
    authorName: authorName(p.author),
  };
}

// Reading estimate comes from the shared content module.

const PUBLISHED_WHERE = { status: "PUBLISHED" as const };

// ── Public category tree (active only, with published post counts) ─────

export async function getBlogCategoryTree(): Promise<BlogCategoryView[]> {
  return safe(async () => {
    const [categories, counts] = await Promise.all([
      prisma.postCategory.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.postCategoryRelation.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        where: { post: { status: "PUBLISHED" } },
      }),
    ]);
    const countByCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));

    const map = new Map<string, BlogCategoryView>();
    for (const c of categories) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image,
        parentId: c.parentId,
        level: c.level,
        sortOrder: c.sortOrder,
        children: [],
        postCount: countByCategory.get(c.id) ?? 0,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
      });
    }
    const roots: BlogCategoryView[] = [];
    for (const node of map.values()) {
      const parent = node.parentId ? map.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }, []);
}

async function fetchBlogCategoryBySlug(
  slug: string
): Promise<BlogCategoryView | null> {
  return safe(async () => {
    const category = await prisma.postCategory.findFirst({
      where: { slug, status: "ACTIVE" },
    });
    if (!category) return null;
    const count = await prisma.postCategoryRelation.count({
      where: { categoryId: category.id, post: { status: "PUBLISHED" } },
    });
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      parentId: category.parentId,
      level: category.level,
      sortOrder: category.sortOrder,
      children: [],
      postCount: count,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
    };
  }, null);
}

// Request-memoized: the blog category/article generateMetadata + page each
// resolve the same slug in one request (identical Prisma queries otherwise).
export const getBlogCategoryBySlug = cache(fetchBlogCategoryBySlug);

/** All descendants of a category (slug-based, for category-page filtering). */
export async function getBlogCategoryDescendantIds(categoryId: string): Promise<string[]> {
  return safe(async () => {
    const rows = await prisma.postCategory.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, parentId: true },
    });
    const childOf = new Map<string, string[]>();
    for (const row of rows) {
      if (row.parentId == null) continue;
      const list = childOf.get(row.parentId) ?? [];
      list.push(row.id);
      childOf.set(row.parentId, list);
    }
    const out = new Set<string>([categoryId]);
    const queue = [categoryId];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const child of childOf.get(parent) ?? []) {
        if (!out.has(child)) {
          out.add(child);
          queue.push(child);
        }
      }
    }
    return [...out];
  }, [categoryId]);
}

// ── Public post lists ──────────────────────────────────────────────────

export async function getPublishedPosts(params: {
  page?: string | number;
  pageSize?: string | number;
  categoryId?: string;
}): Promise<PaginatedResult<BlogPostCard>> {
  return safe(async () => {
    const { page, pageSize, skip, take } = parsePagination({
      page: params.page,
      pageSize: params.pageSize ?? 9,
    });

    const where: Prisma.PostWhereInput = { ...PUBLISHED_WHERE };
    let categoryIds: string[] | undefined;
    if (params.categoryId) {
      categoryIds = await getBlogCategoryDescendantIds(params.categoryId);
      where.categories = { some: { categoryId: { in: categoryIds } } };
    }

    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take,
        select: cardSelect,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      data: rows.map(toCard),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }, { data: [], meta: emptyMeta() });
}

export async function getFeaturedPosts(take = 3): Promise<BlogPostCard[]> {
  return safe(async () => {
    const rows = await prisma.post.findMany({
      where: PUBLISHED_WHERE,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take,
      select: cardSelect,
    });
    return rows.map(toCard);
  }, []);
}

async function fetchPostBySlug(slug: string): Promise<BlogArticle | null> {
  return safe(async () => {
    const post = await prisma.post.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        ...cardSelect,
        content: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        updatedAt: true,
        products: {
          orderBy: { sortOrder: "asc" },
          where: { product: { status: "ACTIVE" } },
          select: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                shortDescription: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
                variants: {
                  where: { isActive: true },
                  orderBy: [{ price: "asc" }],
                  take: 1,
                  select: { price: true },
                },
              },
            },
          },
        },
      },
    });
    if (!post) return null;

    return {
      ...toCard(post),
      // Defense-in-depth: stored content was sanitized on write; re-run the
      // allowlist at render so a compromised row can never reach the page.
      content: renderPostContent(post.content),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      seoKeywords: post.seoKeywords,
      updatedAt: post.updatedAt,
      relatedProducts: post.products.map((p) => ({
        id: p.product.id,
        title: p.product.title,
        slug: p.product.slug,
        shortDescription: p.product.shortDescription,
        image: p.product.images[0]?.url ?? null,
        priceMin: p.product.variants[0]?.price ?? null,
      })),
    };
  }, null);
}

// Memoized for the same generateMetadata + page duplicate-fetch reason.
export const getPostBySlug = cache(fetchPostBySlug);

/** "More like this" — same-category articles, excluding the current one. */
export async function getRelatedPosts(
  postId: string,
  categoryIds: string[],
  take = 3
): Promise<BlogPostCard[]> {
  if (categoryIds.length === 0) return [];
  return safe(async () => {
    const rows = await prisma.post.findMany({
      where: {
        ...PUBLISHED_WHERE,
        id: { not: postId },
        categories: { some: { categoryId: { in: categoryIds } } },
      },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take,
      select: cardSelect,
    });
    return rows.map(toCard);
  }, []);
}

function emptyMeta(): PaginationMeta {
  return { page: 1, pageSize: 9, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
}
