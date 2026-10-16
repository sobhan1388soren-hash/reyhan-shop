import type { AdminProductDetail } from "@/lib/admin/product-service";

export type ProductDraft = {
  mode: "create" | "edit";
  productId?: string;
  title: string;
  slug: string;
  status: string;
  isFeatured: boolean;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  categoryIds: string[];
};

export const emptyProductDraft: ProductDraft = {
  mode: "create",
  title: "",
  slug: "",
  status: "DRAFT",
  isFeatured: false,
  shortDescription: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  categoryIds: [],
};

export function draftFromProduct(product: AdminProductDetail): ProductDraft {
  return {
    mode: "edit",
    productId: product.id,
    title: product.title,
    slug: product.slug,
    status: product.status,
    isFeatured: product.isFeatured,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    seoKeywords: product.seoKeywords ?? "",
    categoryIds: product.categories.map((c) => c.id),
  };
}
