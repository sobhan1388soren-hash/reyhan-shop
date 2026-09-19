"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/actions/products";
import {
  normalizeProductSlug,
  PRODUCT_TITLE_MAX,
  PRODUCT_SLUG_MAX,
  PRODUCT_SHORT_DESCRIPTION_MAX,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_SEO_TITLE_MAX,
  PRODUCT_SEO_DESCRIPTION_MAX,
  PRODUCT_SEO_KEYWORDS_MAX,
} from "@/lib/admin/product-rules";
import type { AdminProductDetail } from "@/lib/admin/product-service";
import type { AdminCategoryOption } from "@/lib/admin/product-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFieldError,
  AdminFormFeedback,
  AdminFormSection,
  AdminSubmitButton,
  adminSelectClass,
  adminTextareaClass,
} from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";

// ProductForm — create/edit for one product's core content. Server actions
// are authoritative (validateProductInput in the service); the HTML
// constraints here are UX only. Slug auto-derives from the title until the
// admin edits it by hand (same normalization as the server).

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

export function ProductForm({
  draft: initialDraft,
  categories,
  onCancel,
}: {
  draft: ProductDraft;
  categories: AdminCategoryOption[];
  onCancel?: () => void;
}) {
  const isEdit = initialDraft.mode === "edit";
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    isEdit ? updateProductAction : createProductAction,
    {}
  );

  const [title, setTitle] = React.useState(initialDraft.title);
  const [slug, setSlug] = React.useState(initialDraft.slug);
  const [slugTouched, setSlugTouched] = React.useState(isEdit && Boolean(initialDraft.slug));
  const effectiveSlug = slugTouched ? slug : normalizeProductSlug(title);

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="productId" value={initialDraft.productId} />}
      {/* Sent through the form so the hidden input below has a stable base. */}
      <input type="hidden" name="slug" value={effectiveSlug} />

      <AdminFormSection title="اطلاعات پایه">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField id="p-title" label="نام محصول" error={state.fieldErrors?.title}>
            <Input
              id="p-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={PRODUCT_TITLE_MAX}
              required
            />
          </AdminField>
          <AdminField
            id="p-slug"
            label="اسلاگ (نشانی آدرس)"
            hint="(اختیاری — از نام ساخته میشود)"
            error={state.fieldErrors?.slug}
          >
            <Input
              id="p-slug"
              dir="ltr"
              className="text-start"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              maxLength={PRODUCT_SLUG_MAX}
              placeholder="water-filter-500"
            />
          </AdminField>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <AdminField id="p-status" label="وضعیت" error={state.fieldErrors?.status}>
            <select
              id="p-status"
              name="status"
              defaultValue={initialDraft.status}
              className={adminSelectClass}
            >
              <option value="DRAFT">پیشنویس (فقط در پنل مدیریت)</option>
              <option value="ACTIVE">فعال (نمایش در فروشگاه)</option>
              <option value="ARCHIVED">آرشیو شده (پنهان از فروشگاه)</option>
            </select>
          </AdminField>
          <AdminField
            id="p-featured"
            label="محصول ویژه"
            hint="(نمایش در بخشهای ویژه)"
          >
            <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                id="p-featured"
                type="checkbox"
                name="isFeatured"
                value="true"
                defaultChecked={initialDraft.isFeatured}
                className="size-4 accent-[var(--reyhan-blue-600)]"
              />
              نمایش بهعنوان محصول ویژه
            </label>
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormSection title="دستهبندیها" description="محصول میتواند به چند دستهبندی متصل باشد.">
        {categories.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
            هنوز دستهبندیای ساخته نشده است. ابتدا از بخش «دستهبندیها» دستهبندی بسازید.
          </p>
        ) : (
          <fieldset>
            <legend className="sr-only">انتخاب دستهبندیها</legend>
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    defaultChecked={initialDraft.categoryIds.includes(category.id)}
                    className="size-4 accent-[var(--reyhan-blue-600)]"
                  />
                  <span className="truncate">
                    {`${"— ".repeat(Math.min(category.level, 5))}${category.name}`}
                  </span>
                  {category.status !== "ACTIVE" && (
                    <span className="text-[10px] text-muted-foreground">(غیرفعال)</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <AdminFieldError message={state.fieldErrors?.categoryIds} />
      </AdminFormSection>

      <AdminFormSection title="محتوای محصول">
        <AdminField
          id="p-short"
          label="توضیح کوتاه"
          error={state.fieldErrors?.shortDescription}
        >
          <textarea
            id="p-short"
            name="shortDescription"
            rows={2}
            maxLength={PRODUCT_SHORT_DESCRIPTION_MAX}
            defaultValue={initialDraft.shortDescription}
            className={adminTextareaClass}
          />
        </AdminField>
        <AdminField
          id="p-desc"
          label="توضیحات کامل"
          error={state.fieldErrors?.description}
          className="mt-4"
        >
          <textarea
            id="p-desc"
            name="description"
            rows={8}
            maxLength={PRODUCT_DESCRIPTION_MAX}
            defaultValue={initialDraft.description}
            className={adminTextareaClass}
          />
        </AdminField>
      </AdminFormSection>

      <AdminFormSection title="سئو (اختیاری)">
        <div className="space-y-4">
          <AdminField id="p-seo-title" label="عنوان سئو" error={state.fieldErrors?.seoTitle}>
            <Input
              id="p-seo-title"
              name="seoTitle"
              maxLength={PRODUCT_SEO_TITLE_MAX}
              placeholder={title || "همان نام محصول"}
              defaultValue={initialDraft.seoTitle}
            />
          </AdminField>
          <AdminField
            id="p-seo-desc"
            label="توضیح سئو (meta description)"
            error={state.fieldErrors?.seoDescription}
          >
            <Input
              id="p-seo-desc"
              name="seoDescription"
              maxLength={PRODUCT_SEO_DESCRIPTION_MAX}
              defaultValue={initialDraft.seoDescription}
            />
          </AdminField>
          <AdminField
            id="p-seo-keywords"
            label="کلمات کلیدی"
            hint="(با کاما جدا کنید)"
            error={state.fieldErrors?.seoKeywords}
          >
            <Input
              id="p-seo-keywords"
              name="seoKeywords"
              maxLength={PRODUCT_SEO_KEYWORDS_MAX}
              defaultValue={initialDraft.seoKeywords}
            />
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormFeedback message={state.message} error={state.error} />

      <div className="flex flex-wrap items-center gap-3">
        <AdminSubmitButton pending={pending}>
          {pending ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ثبت و ادامه"}
        </AdminSubmitButton>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
            )}
          >
            انصراف
          </button>
        )}
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            پس از ساخت محصول، گونهها، قیمت و موجودی را از همین صفحه مدیریت کنید.
          </p>
        )}
      </div>
    </form>
  );
}