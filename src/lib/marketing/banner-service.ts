// Banner service — server-only Prisma adapter for the Phase 16 homepage
// marketing system (hero + promotional strip).
//
// Conventions mirror the existing admin modules (categories/products/
// discounts):
//   - every mutation receives an actor resolved SERVER-SIDE by the action
//     layer (requireAdminForAction → the DB user row); the ADMIN/STAFF
//     allow-list is re-checked here with the existing isAdminCapableRole —
//     client input never carries authorization facts
//   - raw form values never reach Prisma: the pure rules
//     (./banner-rules.ts) normalize/whitelist them first
//   - the hero is a SINGLE active row: activating a HERO banner deactivates
//     the others inside the write transaction
//   - DB failures map to stable machine codes / `{ state: "error" }` — the
//     admin never sees raw database errors and the storefront degrades to
//     the factual structural defaults (no fake content is substituted)

import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma, BannerPlacement } from "@prisma/client";
import { isAdminCapableRole } from "../admin/rules.ts";
import {
  validateBannerInput,
  resolveHeroContent,
  toPromoBannerView,
  BANNER_PLACEMENTS,
  HOMEPAGE_PROMO_MAX,
  type BannerPlacementValue,
  type BannerErrorCode,
  type BannerInputRaw,
  type HeroBannerRow,
  type HeroContentView,
  type PromoBannerView,
} from "./banner-rules.ts";
import { buildPaginationMeta } from "@/lib/catalog/pagination";
import type { PaginationMeta } from "@/lib/catalog/types";

export type Actor = { id: string; role: string };

export type BannerMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: BannerErrorCode; fieldErrors?: Record<string, string> };

function fail(
  error: BannerErrorCode,
  fieldErrors?: Record<string, string>
): BannerMutationResult<never> {
  return { ok: false, error, fieldErrors };
}

function canManageBanners(actor: Actor): boolean {
  return isAdminCapableRole(actor.role);
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[banners] DB query failed; returning fallback:", e);
    return fallback;
  }
}

// ── Storefront reads ────────────────────────────────────────────────────

const HERO_SELECT = {
  title: true,
  description: true,
  imageUrl: true,
  primaryLinkHref: true,
  primaryLinkLabel: true,
  secondaryLinkHref: true,
  secondaryLinkLabel: true,
} satisfies Prisma.BannerSelect;

/**
 * The single active homepage hero. Ordering by sortOrder then createdAt
 * makes the choice deterministic when several HERO rows exist. Returns the
 * raw row; callers merge it with the factual defaults via
 * resolveHeroContent (null → full default content).
 */
export async function getActiveHeroBanner(): Promise<HeroBannerRow | null> {
  return safe(async () => {
    const row = await prisma.banner.findFirst({
      where: { placement: "HERO", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: HERO_SELECT,
    });
    return row ?? null;
  }, null);
}

/** Convenience: the hero content view, defaults merged in. Never null. */
export async function getHeroContent(): Promise<HeroContentView> {
  const banner = await getActiveHeroBanner();
  return resolveHeroContent(banner);
}

/** Active promotional banners, ordered, capped for a tidy strip. */
export async function getActivePromoBanners(
  take: number = HOMEPAGE_PROMO_MAX
): Promise<PromoBannerView[]> {
  const limit = Math.max(1, Math.min(take, HOMEPAGE_PROMO_MAX));
  return safe(async () => {
    const rows = await prisma.banner.findMany({
      where: { placement: "PROMO", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        primaryLinkHref: true,
        primaryLinkLabel: true,
      },
    });
    return rows.map(toPromoBannerView);
  }, []);
}

// ── Admin reads ────────────────────────────────────────────────────────

export const ADMIN_BANNER_SORTS = ["created_desc", "created_asc", "order_asc", "title_asc"] as const;
export type AdminBannerSort = (typeof ADMIN_BANNER_SORTS)[number];

export type AdminBannerListFilters = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  placement?: BannerPlacement;
  sort: AdminBannerSort;
};

export type AdminBannerRow = {
  id: string;
  placement: BannerPlacement;
  title: string;
  description: string | null;
  imageUrl: string | null;
  primaryLinkHref: string | null;
  primaryLinkLabel: string | null;
  secondaryLinkHref: string | null;
  secondaryLinkLabel: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminBannerListResult =
  | { state: "ok"; rows: AdminBannerRow[]; meta: PaginationMeta }
  | { state: "error" };

function bannerOrderBy(sort: AdminBannerSort): Prisma.BannerOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "order_asc":
      return { sortOrder: "asc", createdAt: "asc" };
    case "title_asc":
      return { title: "asc" };
    case "created_desc":
    default:
      return { createdAt: "desc" };
  }
}

export async function getAdminBanners(
  filters: AdminBannerListFilters
): Promise<AdminBannerListResult> {
  try {
    const where: Prisma.BannerWhereInput = {};
    if (filters.placement) where.placement = filters.placement;
    if (filters.q) where.title = { contains: filters.q, mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        orderBy: bannerOrderBy(filters.sort),
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.banner.count({ where }),
    ]);

    return {
      state: "ok",
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
      rows: rows.map((b) => ({
        id: b.id,
        placement: b.placement,
        title: b.title,
        description: b.description,
        imageUrl: b.imageUrl,
        primaryLinkHref: b.primaryLinkHref,
        primaryLinkLabel: b.primaryLinkLabel,
        secondaryLinkHref: b.secondaryLinkHref,
        secondaryLinkLabel: b.secondaryLinkLabel,
        isActive: b.isActive,
        sortOrder: b.sortOrder,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    };
  } catch {
    return { state: "error" };
  }
}

export type AdminBannerDetail = AdminBannerRow;

export type AdminBannerDetailResult =
  | { state: "ok"; data: AdminBannerDetail }
  | { state: "notFound" }
  | { state: "error" };

export async function getAdminBannerById(bannerId: string): Promise<AdminBannerDetailResult> {
  try {
    const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
    if (!banner) return { state: "notFound" };
    return {
      state: "ok",
      data: {
        id: banner.id,
        placement: banner.placement,
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        primaryLinkHref: banner.primaryLinkHref,
        primaryLinkLabel: banner.primaryLinkLabel,
        secondaryLinkHref: banner.secondaryLinkHref,
        secondaryLinkLabel: banner.secondaryLinkLabel,
        isActive: banner.isActive,
        sortOrder: banner.sortOrder,
        createdAt: banner.createdAt,
        updatedAt: banner.updatedAt,
      },
    };
  } catch {
    return { state: "error" };
  }
}

// ── Mutations ──────────────────────────────────────────────────────────

/**
 * Keep at most one active HERO banner. Runs inside the caller's
 * transaction so the invariant is never visible mid-write.
 */
async function enforceSingleActiveHero(
  tx: Prisma.TransactionClient,
  placement: BannerPlacementValue,
  isActive: boolean,
  excludeId?: string
): Promise<void> {
  if (placement !== "HERO" || !isActive) return;
  await tx.banner.updateMany({
    where: {
      placement: "HERO",
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    data: { isActive: false },
  });
}

export async function createBanner(
  actor: Actor,
  raw: BannerInputRaw
): Promise<BannerMutationResult<{ id: string }>> {
  if (!canManageBanners(actor)) return fail("FORBIDDEN");

  const validation = validateBannerInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      await enforceSingleActiveHero(tx, input.placement, input.isActive);

      const created = await tx.banner.create({
        data: {
          placement: input.placement as BannerPlacement,
          title: input.title,
          description: input.description,
          imageUrl: input.imageUrl,
          primaryLinkHref: input.primaryLinkHref,
          primaryLinkLabel: input.primaryLinkLabel,
          secondaryLinkHref: input.secondaryLinkHref,
          secondaryLinkLabel: input.secondaryLinkLabel,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
        select: { id: true },
      });
      return { ok: true as const, data: { id: created.id } };
    });
  } catch {
    return fail("DB_ERROR");
  }
}

export async function updateBanner(
  actor: Actor,
  bannerId: string,
  raw: BannerInputRaw
): Promise<BannerMutationResult<{ id: string }>> {
  if (!canManageBanners(actor)) return fail("FORBIDDEN");

  const validation = validateBannerInput(raw);
  if (!validation.ok) return fail("VALIDATION", validation.errors);
  const input = validation.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.banner.findUnique({
        where: { id: bannerId },
        select: { id: true },
      });
      if (!existing) return fail("NOT_FOUND");

      await enforceSingleActiveHero(tx, input.placement, input.isActive, bannerId);

      await tx.banner.update({
        where: { id: bannerId },
        data: {
          placement: input.placement as BannerPlacement,
          title: input.title,
          description: input.description,
          imageUrl: input.imageUrl,
          primaryLinkHref: input.primaryLinkHref,
          primaryLinkLabel: input.primaryLinkLabel,
          secondaryLinkHref: input.secondaryLinkHref,
          secondaryLinkLabel: input.secondaryLinkLabel,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
        select: { id: true },
      });
      return { ok: true as const, data: { id: bannerId } };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return fail("NOT_FOUND");
    return fail("DB_ERROR");
  }
}

export async function setBannerActive(
  actor: Actor,
  bannerId: string,
  isActive: boolean
): Promise<BannerMutationResult<{ id: string; isActive: boolean }>> {
  if (!canManageBanners(actor)) return fail("FORBIDDEN");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.banner.findUnique({
        where: { id: bannerId },
        select: { id: true, placement: true },
      });
      if (!existing) return fail("NOT_FOUND");

      await enforceSingleActiveHero(
        tx,
        existing.placement as BannerPlacementValue,
        isActive,
        bannerId
      );

      const updated = await tx.banner.update({
        where: { id: bannerId },
        data: { isActive },
        select: { id: true, isActive: true },
      });
      return { ok: true as const, data: { id: updated.id, isActive: updated.isActive } };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return fail("NOT_FOUND");
    return fail("DB_ERROR");
  }
}

export async function deleteBanner(
  actor: Actor,
  bannerId: string
): Promise<BannerMutationResult<{ id: string }>> {
  if (!canManageBanners(actor)) return fail("FORBIDDEN");

  try {
    const existing = await prisma.banner.findUnique({
      where: { id: bannerId },
      select: { id: true },
    });
    if (!existing) return fail("NOT_FOUND");

    await prisma.banner.delete({ where: { id: bannerId } });
    return { ok: true as const, data: { id: bannerId } };
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return fail("NOT_FOUND");
    return fail("DB_ERROR");
  }
}

export { BANNER_PLACEMENTS };
