"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  addProductImageAction,
  updateProductImageAction,
  deleteProductImageAction,
  setPrimaryProductImageAction,
  type ProductActionState,
} from "@/app/actions/products";
import { MEDIA_URL_MAX, MEDIA_ALT_MAX, MEDIA_MAX_PER_PRODUCT } from "@/lib/admin/product-rules";
import type { AdminProductDetail, AdminVariantDetail } from "@/lib/admin/product-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFormFeedback,
  AdminSubmitButton,
  adminSelectClass,
} from "@/components/admin/admin-form";
import { toFaDigits } from "@/lib/catalog/format";

// MediaManager — URL-only media management (no upload/storage in this
// phase). The schema has no primary flag: order is the source of truth and
// the first image is the storefront primary. Reordering / "make primary"
// renumbers server-side.

type ImageRow = AdminProductDetail["images"][number];

function MediaEditForm({
  productId,
  image,
  variants,
  onCancel,
}: {
  productId: string;
  image: ImageRow;
  variants: AdminVariantDetail[];
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    updateProductImageAction,
    {}
  );
  const justSaved = state.message != null && !pending;
  React.useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(onCancel, 400);
      return () => clearTimeout(timer);
    }
  }, [justSaved, onCancel]);

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={image.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField id={`m-url-${image.id}`} label="آدرس رسانه (URL)" error={state.fieldErrors?.url}>
          <Input
            id={`m-url-${image.id}`}
            name="url"
            dir="ltr"
            className="text-start"
            defaultValue={image.url}
            maxLength={MEDIA_URL_MAX}
            required
          />
        </AdminField>
        <AdminField id={`m-alt-${image.id}`} label="متن جایگزین" error={state.fieldErrors?.alt}>
          <Input
            id={`m-alt-${image.id}`}
            name="alt"
            defaultValue={image.alt ?? ""}
            maxLength={MEDIA_ALT_MAX}
          />
        </AdminField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField id={`m-sort-${image.id}`} label="ترتیب نمایش" error={state.fieldErrors?.sortOrder}>
          <Input
            id={`m-sort-${image.id}`}
            name="sortOrder"
            dir="ltr"
            className="text-center"
            inputMode="numeric"
            defaultValue={String(image.sortOrder)}
          />
        </AdminField>
        <AdminField
          id={`m-variant-${image.id}`}
          label="گونه مرتبط"
          hint="(اختیاری)"
          error={state.fieldErrors?.variantId}
          className="sm:col-span-2"
        >
          <select
            id={`m-variant-${image.id}`}
            name="variantId"
            defaultValue={image.variantId ?? ""}
            className={adminSelectClass}
          >
            <option value="">— تصویر عمومی محصول —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </AdminField>
      </div>
      <AdminFormFeedback message={state.message} error={state.error} />
      <div className="flex items-center gap-3">
        <AdminSubmitButton pending={pending}>{pending ? "در حال ذخیره..." : "ذخیره تصویر"}</AdminSubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

function DeleteImageForm({ productId, image }: { productId: string; image: ImageRow }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    deleteProductImageAction,
    {}
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={image.id} />
      {armed ? (
        <>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            تأیید حذف
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            انصراف
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
        >
          حذف
        </button>
      )}
      {state.error && <span className="text-[11px] text-destructive">{state.error}</span>}
    </form>
  );
}

function PrimaryImageForm({ productId, image }: { productId: string; image: ImageRow }) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    setPrimaryProductImageAction,
    {}
  );
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={image.id} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        تصویر اصلی
      </button>
      {state.error && <span className="text-[11px] text-destructive">{state.error}</span>}
    </form>
  );
}

export function MediaManager({
  product,
  variants,
}: {
  product: AdminProductDetail;
  variants: AdminVariantDetail[];
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    addProductImageAction,
    {}
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const atLimit = product.images.length >= MEDIA_MAX_PER_PRODUCT;

  const variantTitle = (variantId: string | null) =>
    variantId ? variants.find((v) => v.id === variantId)?.title ?? "گونه حذفشده" : null;

  return (
    <div className="space-y-5">
      {product.images.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          هنوز تصویری برای این محصول ثبت نشده است.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="رسانههای محصول">
          {product.images.map((image, index) => (
            <li key={image.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start gap-3">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt ?? ""} className="size-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {index === 0 && (
                      <span className="rounded-full bg-[var(--reyhan-blue-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--reyhan-blue-700)]">
                        اصلی
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">ترتیب {toFaDigits(image.sortOrder)}</span>
                    {variantTitle(image.variantId) && (
                      <span className="text-[11px] text-muted-foreground">· {variantTitle(image.variantId)}</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr" title={image.url}>
                    {image.url}
                  </p>
                  {image.alt && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{image.alt}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {index !== 0 && <PrimaryImageForm productId={product.id} image={image} />}
                    <button
                      type="button"
                      onClick={() => setEditingId((id) => (id === image.id ? null : image.id))}
                      className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium transition-colors hover:bg-accent"
                    >
                      ویرایش
                    </button>
                    <DeleteImageForm productId={product.id} image={image} />
                  </div>
                </div>
              </div>
              {editingId === image.id && (
                <div className="mt-3">
                  <MediaEditForm
                    productId={product.id}
                    image={image}
                    variants={variants}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          به سقف {toFaDigits(MEDIA_MAX_PER_PRODUCT)} رسانه برای هر محصول رسیدهاید.
        </p>
      ) : (
        <form action={action} className="space-y-4 rounded-lg border border-dashed p-4">
          <input type="hidden" name="productId" value={product.id} />
          <p className="text-sm font-semibold text-foreground">افزودن رسانه جدید (URL)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField id="m-new-url" label="آدرس رسانه" error={state.fieldErrors?.url}>
              <Input
                id="m-new-url"
                name="url"
                dir="ltr"
                className="text-start"
                placeholder="https://..."
                maxLength={MEDIA_URL_MAX}
                required
              />
            </AdminField>
            <AdminField id="m-new-alt" label="متن جایگزین" error={state.fieldErrors?.alt}>
              <Input id="m-new-alt" name="alt" maxLength={MEDIA_ALT_MAX} />
            </AdminField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField id="m-new-sort" label="ترتیب نمایش" hint="(خالی = آخر)" error={state.fieldErrors?.sortOrder}>
              <Input id="m-new-sort" name="sortOrder" dir="ltr" className="text-center" inputMode="numeric" />
            </AdminField>
            <AdminField
              id="m-new-variant"
              label="گونه مرتبط"
              hint="(اختیاری)"
              error={state.fieldErrors?.variantId}
              className="sm:col-span-2"
            >
              <select id="m-new-variant" name="variantId" className={adminSelectClass} defaultValue="">
                <option value="">— تصویر عمومی محصول —</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>
          <AdminFormFeedback message={state.message} error={state.error} />
          <AdminSubmitButton pending={pending}>
            {pending ? "در حال افزودن..." : "افزودن رسانه"}
          </AdminSubmitButton>
        </form>
      )}

      <p className="text-xs text-muted-foreground">
        ویرایش ویدیو نیز از همین مسیر است؛ آدرس ویدیو (mp4/webm/…) را بهعنوان رسانه ثبت کنید.
      </p>
    </div>
  );
}