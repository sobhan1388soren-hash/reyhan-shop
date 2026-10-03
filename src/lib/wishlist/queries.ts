// Wishlist queries — server-only read layer for wishlist data.

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CatalogProduct } from "@/lib/catalog/types";
import { toCatalogProduct } from "@/lib/catalog/queries";

const productInclude = {
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  variants: { include: { inventory: true } },
  specifications: true,
  images: { orderBy: { sortOrder: "asc" } as const },
} satisfies Prisma.ProductInclude;

export async function getWishlistProducts(wishlistId: string): Promise<CatalogProduct[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId },
    orderBy: { addedAt: "desc" },
    include: {
      product: { include: productInclude },
    },
  });

  const products: CatalogProduct[] = [];
  for (const item of items) {
    if (item.product.status !== "ACTIVE") continue;
    products.push(toCatalogProduct(item.product));
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