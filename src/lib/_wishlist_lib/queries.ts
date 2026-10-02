// Wishlist queries — server-only read layer for wishlist data.

import prisma from "@/lib/prisma";
import type { CatalogProduct } from "@/lib/catalog/types";
import { toCatalogProduct } from "@/lib/catalog/queries";

export async function getWishlistProducts(wishlistId: string): Promise<CatalogProduct[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId },
    orderBy: { addedAt: "desc" },
    include: {
      variantId: {
        include: {
          product: {
            include: {
              categories: { include: { category: true } },
              specifications: true,
              images: true,
              variants: true,
            },
          },
        },
      },
    },
  });

  const products: CatalogProduct[] = [];
  for (const item of items) {
    const variant = item.variantId;
    if (!variant) continue;
    const product = variant.product;
    if (product.status !== "ACTIVE") continue;
    products.push(toCatalogProduct(product));
  }
  return products;
}

export async function getCompareProducts(slugs: string[]): Promise<CatalogProduct[]> {
  if (slugs.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, status: "ACTIVE" },
    include: {
      categories: { include: { category: true } },
      specifications: true,
      images: true,
      variants: {
        where: { isActive: true },
        include: { inventory: true },
      },
    },
  });

  return products.map(toCatalogProduct);
}