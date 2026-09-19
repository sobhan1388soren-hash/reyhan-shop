"use server";

// Product management server actions — Phase 14, Part 1.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default)
// and passes it to the service; roles and ids from form data are never
// trusted. The service performs the authoritative validation.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminForAction } from "@/lib/admin/dal";
import {
  createProduct,
  updateProduct,
  setProductStatus,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  createSpecification,
  updateSpecification,
  deleteSpecification,
  addProductImage,
  updateProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  adjustVariantInventory,
  updateInventoryThreshold,
} from "@/lib/admin/product-service";
import type { ProductErrorCode } from "@/lib/admin/product-rules";
import { PRODUCT_ERROR_MESSAGES } from "@/lib/admin/product-rules";

export type ProductActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(error: ProductErrorCode, fieldErrors?: Record<string, string>): ProductActionState {
  return { error: PRODUCT_ERROR_MESSAGES[error], fieldErrors };
}

function revalidateProducts(productSlug?: string): void {
  revalidatePath("/admin/products");
  if (productSlug) revalidatePath(`/admin/products/${productSlug}`);
  // Product content feeds the public catalog.
  revalidatePath("/products");
  revalidatePath("/");
}

function readProductInput(formData: FormData) {
  return {
    title: str(formData, "title"),
    slug: str(formData, "slug"),
    status: str(formData, "status"),
    isFeatured: str(formData, "isFeatured"),
    shortDescription: str(formData, "shortDescription"),
    description: str(formData, "description"),
    seoTitle: str(formData, "seoTitle"),
    seoDescription: str(formData, "seoDescription"),
    seoKeywords: str(formData, "seoKeywords"),
    categoryIds: formData.getAll("categoryIds").filter((v): v is string => typeof v === "string"),
  };
}

function readVariantInput(formData: FormData) {
  return {
    title: str(formData, "title"),
    sku: str(formData, "sku"),
    barcode: str(formData, "barcode"),
    price: str(formData, "price"),
    compareAtPrice: str(formData, "compareAtPrice"),
    costPrice: str(formData, "costPrice"),
    weight: str(formData, "weight"),
    isDefault: str(formData, "isDefault"),
    isActive: str(formData, "isActive"),
    sortOrder: str(formData, "sortOrder"),
  };
}

// ── Product core ───────────────────────────────────────────────────────

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const result = await createProduct(actor, readProductInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts();
  // A new product has no variants yet — send the admin straight to its
  // management page to add variants, pricing, inventory and media.
  redirect(`/admin/products/${result.data.id}?created=1`);
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await updateProduct(actor, productId, readProductInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(productId);
  return { message: "محصول بهروزرسانی شد." };
}

export async function setProductStatusAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await setProductStatus(actor, productId, str(formData, "status"));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(productId);
  const status = result.data.status;
  return {
    message:
      status === "ACTIVE"
        ? "محصول فعال شد و در فروشگاه نمایش داده میشود."
        : status === "ARCHIVED"
          ? "محصول آرشیو شد و از فروشگاه پنهان میگردد."
          : "محصول به پیشنویس منتقل شد.",
  };
}

export async function deleteProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await deleteProduct(actor, productId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts();
  // The detail page no longer exists — return to the list.
  redirect("/admin/products");
  return { message: "محصول حذف شد." };
}

// ── Variants ──────────────────────────────────────────────────────────

export async function createVariantAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await createVariant(actor, productId, readVariantInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(productId);
  return { message: "گونه با موفقیت اضافه شد." };
}

export async function updateVariantAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const variantId = str(formData, "variantId");
  if (!variantId) return failure("VALIDATION");
  const result = await updateVariant(actor, variantId, readVariantInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "گونه بهروزرسانی شد." };
}

export async function deleteVariantAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const variantId = str(formData, "variantId");
  if (!variantId) return failure("VALIDATION");
  const result = await deleteVariant(actor, variantId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "گونه حذف شد." };
}

// ── Specifications ─────────────────────────────────────────────────────

export async function createSpecificationAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await createSpecification(actor, productId, {
    key: str(formData, "key"),
    value: str(formData, "value"),
    sortOrder: str(formData, "sortOrder"),
  });
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(productId);
  return { message: "ویژگی اضافه شد." };
}

export async function updateSpecificationAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const specificationId = str(formData, "specificationId");
  if (!specificationId) return failure("VALIDATION");
  const result = await updateSpecification(actor, specificationId, {
    key: str(formData, "key"),
    value: str(formData, "value"),
    sortOrder: str(formData, "sortOrder"),
  });
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "ویژگی بهروزرسانی شد." };
}

export async function deleteSpecificationAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const specificationId = str(formData, "specificationId");
  if (!specificationId) return failure("VALIDATION");
  const result = await deleteSpecification(actor, specificationId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "ویژگی حذف شد." };
}

// ── Media / images ─────────────────────────────────────────────────────

function readMediaInput(formData: FormData) {
  return {
    url: str(formData, "url"),
    alt: str(formData, "alt"),
    sortOrder: str(formData, "sortOrder"),
    variantId: str(formData, "variantId"),
  };
}

export async function addProductImageAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const productId = str(formData, "productId");
  if (!productId) return failure("VALIDATION");
  const result = await addProductImage(actor, productId, readMediaInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(productId);
  return { message: "تصویر اضافه شد." };
}

export async function updateProductImageAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const imageId = str(formData, "imageId");
  if (!imageId) return failure("VALIDATION");
  const result = await updateProductImage(actor, imageId, readMediaInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "تصویر بهروزرسانی شد." };
}

export async function deleteProductImageAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const imageId = str(formData, "imageId");
  if (!imageId) return failure("VALIDATION");
  const result = await deleteProductImage(actor, imageId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "تصویر حذف شد." };
}

export async function setPrimaryProductImageAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const imageId = str(formData, "imageId");
  if (!imageId) return failure("VALIDATION");
  const result = await setPrimaryProductImage(actor, imageId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "تصویر اصلی تعیین شد." };
}

// ── Inventory ──────────────────────────────────────────────────────────

export async function adjustInventoryAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const variantId = str(formData, "variantId");
  if (!variantId) return failure("VALIDATION");
  const result = await adjustVariantInventory(actor, variantId, {
    mode: str(formData, "mode"),
    amount: str(formData, "amount"),
    reason: str(formData, "reason"),
  });
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "موجودی به‌روزرسانی شد." };
}

export async function updateInventoryThresholdAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const actor = await requireAdminForAction();
  const variantId = str(formData, "variantId");
  if (!variantId) return failure("VALIDATION");
  const result = await updateInventoryThreshold(actor, variantId, str(formData, "lowStockThreshold"));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateProducts(str(formData, "productId"));
  return { message: "آستانه موجودی کم ذخیره شد." };
}