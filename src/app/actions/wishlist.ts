"use server";

// Wishlist server actions — Phase 22.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getWishlistForUserOrCreate,
  addToWishlist,
  removeFromWishlist,
  shareWishlist,
  unshareWishlist,
  updateWishlistTitle,
} from "@/lib/wishlist/service";

export async function addToWishlistAction(productId: string, variantId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { state: "unauthenticated" as const };
  }

  const result = await getWishlistForUserOrCreate(user.id);
  if (result.state === "error") {
    return { state: "error" as const };
  }

  const wishlist = result.wishlist;
  if (!wishlist) {
    return { state: "error" as const };
  }

  const addResult = await addToWishlist(wishlist.id, productId, variantId);
  if (addResult.state === "error") {
    return { state: "error" as const };
  }

  revalidatePath("/wishlist");
  return { state: "added" as const };
}

export async function removeFromWishlistAction(productId: string, variantId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { state: "unauthenticated" as const };
  }

  const result = await getWishlistForUserOrCreate(user.id);
  if (result.state === "error") {
    return { state: "error" as const };
  }

  const wishlist = result.wishlist;
  if (!wishlist) {
    return { state: "error" as const };
  }

  await removeFromWishlist(wishlist.id, productId, variantId);
  revalidatePath("/wishlist");
  return { state: "removed" as const };
}

export async function shareWishlistAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { state: "unauthenticated" as const, shareId: null };
  }

  const result = await getWishlistForUserOrCreate(user.id);
  if (result.state === "error") {
    return { state: "error" as const, shareId: null };
  }

  const wishlist = result.wishlist;
  if (!wishlist) {
    return { state: "error" as const, shareId: null };
  }

  const shareResult = await shareWishlist(wishlist.id);
  if (shareResult.state === "error") {
    return { state: "error" as const, shareId: null };
  }

  revalidatePath("/wishlist");
  return { state: "ok" as const, shareId: shareResult.shareId };
}

export async function unshareWishlistAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { state: "unauthenticated" as const };
  }

  const result = await getWishlistForUserOrCreate(user.id);
  if (result.state === "error") {
    return { state: "error" as const };
  }

  const wishlist = result.wishlist;
  if (!wishlist) {
    return { state: "error" as const };
  }

  await unshareWishlist(wishlist.id);
  revalidatePath("/wishlist");
  return { state: "ok" as const };
}

export async function updateWishlistTitleAction(title: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { state: "unauthenticated" as const };
  }

  const result = await getWishlistForUserOrCreate(user.id);
  if (result.state === "error") {
    return { state: "error" as const };
  }

  const wishlist = result.wishlist;
  if (!wishlist) {
    return { state: "error" as const };
  }

  await updateWishlistTitle(wishlist.id, title);
  revalidatePath("/wishlist");
  return { state: "ok" as const };
}