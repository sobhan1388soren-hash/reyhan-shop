// Wishlist service — server-only Prisma adapter for wishlist operations.
// Phase 22: supports personal wishlists and shareable public links.

import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";

function makeShareSlug(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export type WishlistResult =
  | { state: "ok"; wishlist: Awaited<ReturnType<typeof prisma.wishlist.findUnique>> }
  | { state: "error" };

export async function getWishlistByUserId(userId: string): Promise<WishlistResult> {
  try {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { addedAt: "desc" },
          include: { variantId: true },
        },
      },
    });
    return { state: "ok", wishlist };
  } catch {
    return { state: "error" };
  }
}

export async function getWishlistByShareId(shareId: string): Promise<WishlistResult> {
  try {
    const wishlist = await prisma.wishlist.findUnique({
      where: { shareId, isPublic: true },
      include: {
        items: {
          orderBy: { addedAt: "desc" },
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return { state: "ok", wishlist };
  } catch {
    return { state: "error" };
  }
}

export async function getWishlistForUserOrCreate(userId: string): Promise<WishlistResult> {
  try {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { orderBy: { addedAt: "desc" } } },
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: { orderBy: { addedAt: "desc" } } },
      });
    }
    return { state: "ok", wishlist };
  } catch {
    return { state: "error" };
  }
}

export async function addToWishlist(
  wishlistId: string,
  productId: string,
  variantId?: string
): Promise<{ state: "ok" } | { state: "error" } | { state: "exists" }> {
  try {
    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId_variantId: { wishlistId, productId, variantId: variantId ?? null } },
    });
    if (existing) return { state: "exists" };

    await prisma.wishlistItem.create({
      data: { wishlistId, productId, variantId: variantId ?? null },
    });
    return { state: "ok" };
  } catch {
    return { state: "error" };
  }
}

export async function removeFromWishlist(
  wishlistId: string,
  productId: string,
  variantId?: string
): Promise<{ state: "ok" } | { state: "error" }> {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId, productId, variantId: variantId ?? null },
    });
    return { state: "ok" };
  } catch {
    return { state: "error" };
  }
}

export async function shareWishlist(wishlistId: string): Promise<{ state: "ok"; shareId: string } | { state: "error" }> {
  try {
    const existing = await prisma.wishlist.findUnique({
      where: { id: wishlistId },
      select: { shareId: true },
    });
    if (existing?.shareId) {
      return { state: "ok", shareId: existing.shareId };
    }
    const shareId = makeShareSlug();
    await prisma.wishlist.update({
      where: { id: wishlistId },
      data: { shareId, isPublic: true },
    });
    return { state: "ok", shareId };
  } catch {
    return { state: "error" };
  }
}

export async function unshareWishlist(wishlistId: string): Promise<{ state: "ok" } | { state: "error" }> {
  try {
    await prisma.wishlist.update({
      where: { id: wishlistId },
      data: { shareId: null, isPublic: false },
    });
    return { state: "ok" };
  } catch {
    return { state: "error" };
  }
}

export async function updateWishlistTitle(
  wishlistId: string,
  title: string
): Promise<{ state: "ok" } | { state: "error" }> {
  try {
    await prisma.wishlist.update({
      where: { id: wishlistId },
      data: { title: title.slice(0, 200) },
    });
    return { state: "ok" };
  } catch {
    return { state: "error" };
  }
}