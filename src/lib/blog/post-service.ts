// Blog post management service — server-only Prisma adapter for the pure
// post rules (./post-rules.ts) and content sanitizer (./content.ts).
// Phase 15.
//
// Security model (mirrors catalog/admin service conventions):
//   - every mutation receives an actor resolved SERVER-SIDE by the action
//     layer (requireAdminForAction → the DB user row); the role is
//     re-checked here with the existing ADMIN/STAFF allow-list — client
//     input never carries authorization facts
//   - rich content is sanitized by the pure allowlist rewriter
//     (./content.ts) inside validatePostInput BEFORE it is written, and
//     re-sanitized at render time; nothing unsanitized is ever stored
//   - category/related-product/author ids are re-verified against real
//     rows inside the write transaction — forged ids never reach Prisma
//     and a missing one is reported as a stable machine code
//   - publishing requires real content; drafts may be saved at any
//     completeness (validated in the pure rules, not here)
//   - publishedAt is stamped on first publish and preserved thereafter
//   - DB failures map to stable machine codes with Persian copy — admin
//     never sees raw database errors, and no fake data is substituted
//
// Public read queries (no admin gate) live in ./queries.ts so public pages
// never import this module.

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, PostStatus } from "@prisma/client";
import { isAdminCapableRole } from "../admin/rules.ts";
import { buildPaginationMeta } from "../catalog/pagination.ts";
import type { PaginationMeta } from "../catalog/types.ts";
import {
  validatePostInput,
  normalizePostCategoryIds,
  normalizeRelatedProductIds,
  publishFieldFor,
  POST_STATUSES,
  POST_SORTS,
  parsePostSort,
  type PostInputRaw,
  type NormalizedPostInput,
  type PostSort,
  type PostErrorCode,
} from "./post-rules.ts";
import {
  getAdminPostCategoryTree,
  getPostAuthorOptions,
  type AdminPostCategoryNode,
  type PostAuthorOption,
} from "./category-service.ts";

export type PostMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: PostErrorCode; fieldErrors?: Record<string, string> };

type Actor = { id: string; role: string };

function canManagePosts(actor: Actor): boolean {
  // Content management uses the existing ADMIN/STAFF allow-list.
  return isAdminCapableRole(actor.role);
}

function failResult(code: PostErrorCode): PostMutationResult<never> {
  return { ok: false, error: code };
}

// ── Admin list ─────────────────────────────────────────────────────────

export type AdminPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  categories: { id: string; name: string; slug: string }[];
  productCount: number;
};

export type AdminPostListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  status?: PostStatus;
  categoryId?: string;
  sort: PostSort;
};

export type AdminPostListResult =
  | { state: "ok"; rows: AdminPostRow[]; meta: PaginationMeta }
  | { state: "error" };

const postListOrderBy: Record<
  PostSort,
  Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[]
> = {
  published_desc: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  published_asc: [{ publishedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  updated_desc: { updatedAt: "desc" },
  created_desc: { createdAt: "desc" },
  title_asc: { title: "asc" },
  title_desc: { title: "desc" },
};

function authorName(user: {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string;
}): string | null {
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    null
  );
}

export async function getAdminPosts(
  filters: AdminPostListFilters
): Promise<AdminPostListResult> {
  try {
    const where: Prisma.PostWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categories = { some: { categoryId: filters.categoryId } };
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: "insensitive" } },
        { excerpt: { contains: filters.q, mode: "insensitive" } },
        { slug: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: postListOrderBy[filters.sort],
        skip: filters.skip,
        take: filters.take,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { firstName: true, lastName: true, displayName: true, phone: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
          products: { select: { productId: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        status: p.status,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        authorName: p.author ? authorName(p.author) : null,
        categories: p.categories.map((c) => c.category),
        productCount: p.products.length,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

// ── Admin detail (edit form source of truth) ───────────────────────────

export type AdminPostDetail = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: PostStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  authorId: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categories: { id: string; name: string; slug: string }[];
  products: { id: string; title: string; slug: string; sortOrder: number }[];
};

export type AdminPostDetailResult =
  | { state: "ok"; data: AdminPostDetail }
  | { state: "notFound" }
  | { state: "error" };

export async function getAdminPostById(postId: string): Promise<AdminPostDetailResult> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImage: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        authorId: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { firstName: true, lastName: true, displayName: true, phone: true } },
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        products: {
          orderBy: { sortOrder: "asc" },
          select: {
            sortOrder: true,
            product: {
              select: { id: true, title: true, slug: true, status: true },
            },
          },
        },
      },
    });
    if (!post) return { state: "notFound" };

    return {
      state: "ok",
      data: {
        ...post,
        authorName: post.author ? authorName(post.author) : null,
        categories: post.categories.map((c) => c.category),
        products: post.products.map((p) => ({
          id: p.product.id,
          title: p.product.title,
          slug: p.product.slug,
          sortOrder: p.sortOrder,
        })),
      },
    };
  } catch {
    return { state: "error" };
  }
}

// ── Product picker options (for the related-products control) ─────────

export type PostProductOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

/**
 * Real catalog products for the admin picker. Active products first, then
 * drafts, so the content manager sees sellable items by default. Search is
 * server-side and capped.
 */
export async function getProductOptions(
  q?: string,
  ids?: string[]
): Promise<PostProductOption[]> {
  try {
    const where: Prisma.ProductWhereInput = {};
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }
    if (ids && ids.length > 0) {
      // Always include the already-selected ids even if they no longer
      // match the search term (keeps the selection visible while typing).
      where.OR = [
        ...(where.OR as Prisma.ProductWhereInput[]),
        { id: { in: ids } },
      ];
    }
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ status: "asc" }, { title: "asc" }],
      take: 40,
      select: { id: true, title: true, slug: true, status: true },
    });
    return products;
  } catch {
    return [];
  }
}

// ── Writes ─────────────────────────────────────────────────────────────

type PostWriteInput = {
  input: NormalizedPostInput;
  categoryIds: string[];
  productIds: string[];
};

async function verifyRelations(
  tx: Prisma.TransactionClient,
  input: PostWriteInput
): Promise<PostErrorCode | null> {
  if (input.categoryIds.length > 0) {
    const found = await tx.postCategory.count({ where: { id: { in: input.categoryIds } } });
    if (found !== input.categoryIds.length) return "INVALID_CATEGORY";
  }
  if (input.productIds.length > 0) {
    const found = await tx.product.count({ where: { id: { in: input.productIds } } });
    if (found !== input.productIds.length) return "INVALID_PRODUCTS";
  }
  if (input.input.authorId) {
    const author = await tx.user.count({
      where: { id: input.input.authorId, role: { in: ["ADMIN", "STAFF"] } },
    });
    if (author === 0) return "INVALID_AUTHOR";
  }
  return null;
}

function categoryCreate(input: string[]) {
  return input.map((categoryId) => ({ category: { connect: { id: categoryId } } }));
}

function productCreate(productIds: string[]) {
  return productIds.map((productId, index) => ({
    product: { connect: { id: productId } },
    sortOrder: index,
  }));
}

export async function createPost(
  actor: Actor,
  raw: PostInputRaw,
  categoryIdsRaw: unknown,
  productIdsRaw: unknown
): Promise<PostMutationResult<{ id: string }>> {
  if (!canManagePosts(actor)) return failResult("FORBIDDEN");

  const productsCheck = normalizeRelatedProductIds(productIdsRaw);
  if (!productsCheck.ok) return failResult(productsCheck.error === "TOO_MANY" ? "PRODUCT_LIMIT" : "VALIDATION");

  const validation = validatePostInput(raw);
  if (!validation.ok) return { ok: false, error: "VALIDATION", fieldErrors: validation.errors };

  const write: PostWriteInput = {
    input: validation.data,
    categoryIds: normalizePostCategoryIds(categoryIdsRaw),
    productIds: productsCheck.ids,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const relationError = await verifyRelations(tx, write);
      if (relationError) return failResult(relationError);

      try {
        const created = await tx.post.create({
          data: {
            title: write.input.title,
            slug: write.input.slug,
            excerpt: write.input.excerpt,
            content: write.input.content,
            coverImage: write.input.coverImage,
            status: write.input.status,
            seoTitle: write.input.seoTitle,
            seoDescription: write.input.seoDescription,
            seoKeywords: write.input.seoKeywords,
            authorId: write.input.authorId,
            publishedAt: publishFieldFor(write.input.status, null),
            categories: { create: categoryCreate(write.categoryIds) },
            products: { create: productCreate(write.productIds) },
          },
          select: { id: true },
        });
        return { ok: true as const, data: { id: created.id } };
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return failResult("DUPLICATE_SLUG");
        throw e;
      }
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

export async function updatePost(
  actor: Actor,
  postId: string,
  raw: PostInputRaw,
  categoryIdsRaw: unknown,
  productIdsRaw: unknown
): Promise<PostMutationResult<{ id: string }>> {
  if (!canManagePosts(actor)) return failResult("FORBIDDEN");

  const productsCheck = normalizeRelatedProductIds(productIdsRaw);
  if (!productsCheck.ok) return failResult(productsCheck.error === "TOO_MANY" ? "PRODUCT_LIMIT" : "VALIDATION");

  const validation = validatePostInput(raw);
  if (!validation.ok) return { ok: false, error: "VALIDATION", fieldErrors: validation.errors };

  const write: PostWriteInput = {
    input: validation.data,
    categoryIds: normalizePostCategoryIds(categoryIdsRaw),
    productIds: productsCheck.ids,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, publishedAt: true, slug: true },
      });
      if (!existing) return failResult("NOT_FOUND");

      const relationError = await verifyRelations(tx, write);
      if (relationError) return failResult(relationError);

      // Slug uniqueness excluding self (the DB unique constraint would also
      // fire on update, but this reports DUPLICATE_SLUG cleanly).
      if (write.input.slug !== existing.slug) {
        const clash = await tx.post.count({
          where: { slug: write.input.slug, NOT: { id: postId } },
        });
        if (clash > 0) return failResult("DUPLICATE_SLUG");
      }

      try {
        await tx.post.update({
          where: { id: postId },
          data: {
            title: write.input.title,
            slug: write.input.slug,
            excerpt: write.input.excerpt,
            content: write.input.content,
            coverImage: write.input.coverImage,
            status: write.input.status,
            seoTitle: write.input.seoTitle,
            seoDescription: write.input.seoDescription,
            seoKeywords: write.input.seoKeywords,
            authorId: write.input.authorId,
            publishedAt: publishFieldFor(write.input.status, existing.publishedAt),
            // Replace the relation sets atomically (composite PKs make a
            // full swap safe — no orphan rows, order preserved).
            categories: {
              deleteMany: {},
              create: categoryCreate(write.categoryIds),
            },
            products: {
              deleteMany: {},
              create: productCreate(write.productIds),
            },
          },
          select: { id: true },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return failResult("DUPLICATE_SLUG");
        throw e;
      }

      return { ok: true as const, data: { id: postId } };
    });
  } catch {
    return failResult("DB_ERROR");
  }
}

// ── Quick status change from the list ──────────────────────────────────

export async function setPostStatus(
  actor: Actor,
  postId: string,
  status: unknown
): Promise<PostMutationResult<{ id: string; status: string }>> {
  if (!canManagePosts(actor)) return failResult("FORBIDDEN");

  const normalized: PostStatus | null =
    typeof status === "string" && (POST_STATUSES as readonly string[]).includes(status)
      ? (status as PostStatus)
      : null;
  if (!normalized) return failResult("VALIDATION");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, publishedAt: true, content: true },
      });
      if (!existing) return failResult("NOT_FOUND");

      // Publishing requires real content — same rule as the form, enforced
      // server-side so no other path can publish an empty post.
      if (normalized === "PUBLISHED") {
        const prose = existing.content.replace(/<[^>]*>/g, "").trim();
        if (!prose) return failResult("VALIDATION");
      }

      const updated = await tx.post.update({
        where: { id: postId },
        data: { status: normalized, publishedAt: publishFieldFor(normalized, existing.publishedAt) },
        select: { id: true, status: true },
      });
      return { ok: true as const, data: { id: updated.id, status: updated.status } };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return failResult("NOT_FOUND");
    return failResult("DB_ERROR");
  }
}

// ── Delete (posts own no dependent business records — links cascade) ───

export async function deletePost(
  actor: Actor,
  postId: string
): Promise<PostMutationResult<{ id: string }>> {
  if (!canManagePosts(actor)) return failResult("FORBIDDEN");

  try {
    await prisma.post.delete({ where: { id: postId } });
    return { ok: true as const, data: { id: postId } };
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return failResult("NOT_FOUND");
    return failResult("DB_ERROR");
  }
}

// ── Internal-link targets (for the editor's "insert internal link") ────

export type InternalLinkTarget = { title: string; href: string };

/**
 * Lightweight lists of publishable internal targets so the rich editor can
 * offer real links to existing content (posts, blog categories, products
 * and product categories) instead of free-text URLs. Read-only and capped.
 */
export async function getInternalLinkTargets(): Promise<{
  posts: InternalLinkTarget[];
  blogCategories: InternalLinkTarget[];
  products: InternalLinkTarget[];
  productCategories: InternalLinkTarget[];
}> {
  try {
    const [posts, blogCategories, products, productCategories] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 40,
        select: { title: true, slug: true },
      }),
      prisma.postCategory.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 40,
        select: { name: true, slug: true },
      }),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { title: "asc" },
        take: 40,
        select: { title: true, slug: true },
      }),
      prisma.category.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 40,
        select: { name: true, slug: true },
      }),
    ]);

    return {
      posts: posts.map((p) => ({ title: p.title, href: `/blog/${p.slug}` })),
      blogCategories: blogCategories.map((c) => ({
        title: c.name,
        href: `/blog/category/${c.slug}`,
      })),
      products: products.map((p) => ({ title: p.title, href: `/products/${p.slug}` })),
      productCategories: productCategories.map((c) => ({
        title: c.name,
        href: `/categories/${c.slug}`,
      })),
    };
  } catch {
    // Public/editor convenience only — empty lists just hide the picker.
    return { posts: [], blogCategories: [], products: [], productCategories: [] };
  }
}

// Re-exported for the admin page's sort whitelisting.
export { parsePostSort, POST_STATUSES, POST_SORTS };

// ── Editor context (one round-trip for the create/edit pages) ──────────

export type PostFormContext = {
  categories: AdminPostCategoryNode[];
  products: PostProductOption[];
  authors: PostAuthorOption[];
  internalTargets: {
    posts: InternalLinkTarget[];
    blogCategories: InternalLinkTarget[];
    products: InternalLinkTarget[];
    productCategories: InternalLinkTarget[];
  };
};

/**
 * Everything the post create/edit form needs, fetched in parallel. Each
 * part degrades to an empty list on DB failure (the form renders its own
 * empty states), so a partial outage never blocks the editor.
 */
export async function getPostFormContext(
  selectedProductIds?: string[]
): Promise<PostFormContext> {
  const [categoryTree, authors, internalTargets, products] = await Promise.all([
    getAdminPostCategoryTree(),
    getPostAuthorOptions(),
    getInternalLinkTargets(),
    getProductOptions(undefined, selectedProductIds),
  ]);
  return {
    categories: categoryTree.state === "ok" ? categoryTree.categories : [],
    authors,
    internalTargets,
    products,
  };
}
