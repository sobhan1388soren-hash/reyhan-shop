"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createVariantAction,
  updateVariantAction,
  deleteVariantAction,
  adjustInventoryAction,
  type ProductActionState,
} from "@/app/actions/products";
import {
  VARIANT_TITLE_MAX,
  VARIANT_SKU_MAX,
  VARIANT_BARCODE_MAX,
  MAX_PRICE_TOMAN,
} from "@/lib/admin/product-rules";
import type { AdminVariantDetail } from "@/lib/admin/product-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFormFeedback,
  AdminSubmitButton,
  adminSelectClass,
} from "@/components/admin/admin-form";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

// VariantForm — create/edit one purchasing variant. Money is entered in
// Toman and converted to Rial server-side; the server re-validates SKU /
// barcode uniqueness. costPrice is only rendered for ADMIN.

export type VariantDraft = {
  mode: "create" | "edit";
  variantId?: string;
  title: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  weight: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
};

export const emptyVariantDraft: VariantDraft = {
  mode: "create",
  title: "",
  sku: "",
  barcode: "",
  price: "",
  compareAtPrice: "",
  costPrice: "",
  weight: "",
  isDefault: false,
  isActive: true,
  sortOrder: "0",
};

function tomanField(rial: number | null): string {
  if (rial == null) return "";
  return String(Math.round(rial / 10));
}

export function draftFromVariant(variant: AdminVariantDetail): VariantDraft {
  return {
    mode: "edit",
    variantId: variant.id,
    title: variant.title,
    sku: variant.sku,
    barcode: variant.barcode ?? "",
    price: tomanField(variant.price),
    compareAtPrice: tomanField(variant.compareAtPrice),
    costPrice: tomanField(variant.costPrice),
    weight: variant.weight != null ? String(variant.weight) : "",
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    sortOrder: String(variant.sortOrder),
  };
}

export function VariantForm({
  productId,
  draft: initialDraft,
  canViewCost,
  onCancel,
}: {
  productId: string;
  draft: VariantDraft;
  canViewCost: boolean;
  onCancel: () => void;
}) {
  const isEdit = initialDraft.mode === "edit";
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    isEdit ? updateVariantAction : createVariantAction,
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {isEdit && <input type="hidden" name="variantId" value={initialDraft.variantId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField id="v-title" label="عنوان گونه" error={state.fieldErrors?.title}>
          <Input
            id="v-title"
            name="title"
            defaultValue={initialDraft.title}
            maxLength={VARIANT_TITLE_MAX}
            placeholder="مثلاً: ۵۰۰ لیتر — سبز"
            required
          />
        </AdminField>
        <AdminField id="v-sku" label="کد کالا (SKU)" error={state.fieldErrors?.sku}>
          <Input
            id="v-sku"
            name="sku"
            dir="ltr"
            className="text-start"
            defaultValue={initialDraft.sku}
            maxLength={VARIANT_SKU_MAX}
            placeholder="WF-500-GR"
            required
          />
        </AdminField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          id="v-barcode"
          label="بارکد"
          hint="(اختیاری — ۸ تا ۱۴ رقم)"
          error={state.fieldErrors?.barcode}
        >
          <Input
            id="v-barcode"
            name="barcode"
            dir="ltr"
            className="text-start"
            inputMode="numeric"
            defaultValue={initialDraft.barcode}
            maxLength={VARIANT_BARCODE_MAX}
          />
        </AdminField>
        <AdminField
          id="v-weight"
          label="وزن (گرم)"
          hint="(اختیاری)"
          error={state.fieldErrors?.weight}
        >
          <Input
            id="v-weight"
            name="weight"
            dir="ltr"
            className="text-start"
            inputMode="numeric"
            defaultValue={initialDraft.weight}
          />
        </AdminField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField
          id="v-price"
          label="قیمت فروش (تومان)"
          error={state.fieldErrors?.price}
        >
          <Input
            id="v-price"
            name="price"
            dir="ltr"
            className="text-start"
            inputMode="numeric"
            defaultValue={initialDraft.price}
            placeholder={`حداکثر ${MAX_PRICE_TOMAN.toLocaleString("en-US")}`}
            required
          />
        </AdminField>
        <AdminField
          id="v-compare"
          label="قیمت خطخورده (تومان)"
          hint="(اختیاری)"
          error={state.fieldErrors?.compareAtPrice}
        >
          <Input
            id="v-compare"
            name="compareAtPrice"
            dir="ltr"
            className="text-start"
            inputMode="numeric"
            defaultValue={initialDraft.compareAtPrice}
          />
        </AdminField>
        {canViewCost && (
          <AdminField
            id="v-cost"
            label="قیمت تمامشده (تومان)"
            hint="(داخلی)"
            error={state.fieldErrors?.costPrice}
          >
            <Input
              id="v-cost"
              name="costPrice"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.costPrice}
            />
          </AdminField>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField id="v-sort" label="ترتیب نمایش" error={state.fieldErrors?.sortOrder}>
          <Input
            id="v-sort"
            name="sortOrder"
            dir="ltr"
            className="text-center"
            inputMode="numeric"
            defaultValue={initialDraft.sortOrder}
          />
        </AdminField>
        <AdminField id="v-active" label="وضعیت گونه">
          <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={initialDraft.isActive}
              className="size-4 accent-[var(--reyhan-blue-600)]"
            />
            قابل خرید باشد
          </label>
        </AdminField>
        <AdminField id="v-default" label="گونه پیشفرض">
          <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              value="true"
              defaultChecked={initialDraft.isDefault}
              className="size-4 accent-[var(--reyhan-blue-600)]"
            />
            انتخاب پیشفرض در فروشگاه
          </label>
        </AdminField>
      </div>

      <AdminFormFeedback message={state.message} error={state.error} />

      <div className="flex items-center gap-3">
        <AdminSubmitButton pending={pending}>
          {pending ? "در حال ذخیره..." : isEdit ? "ذخیره گونه" : "افزودن گونه"}
        </AdminSubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
          )}
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

// ── Inventory adjustment form ─────────────────────────────────────────

export function InventoryForm({
  productId,
  variant,
  onDone,
}: {
  productId: string;
  variant: AdminVariantDetail;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    adjustInventoryAction,
    {}
  );
  const justSaved = state.message != null && !pending;

  return (
    <form
      action={action}
      className="space-y-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant.id} />

      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        موجودی فعلی: <strong className="font-semibold text-foreground">{toFaDigits(variant.inventory?.quantity ?? 0)}</strong>{" "}
        · رزروشده: {toFaDigits(variant.inventory?.reservedQuantity ?? 0)} · قابل فروش:{" "}
        {toFaDigits(Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0)))}
        {variant.price != null && <> · قیمت: {formatPriceToman(variant.price)}</>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField id={`inv-mode-${variant.id}`} label="نوع عملیات" error={state.fieldErrors?.mode}>
          <select id={`inv-mode-${variant.id}`} name="mode" className={adminSelectClass} defaultValue="RESTOCK">
            <option value="RESTOCK">ورود موجودی (افزودن)</option>
            <option value="ADJUSTMENT">اصلاح موجودی (مثبت/منفی)</option>
          </select>
        </AdminField>
        <AdminField
          id={`inv-amount-${variant.id}`}
          label="مقدار"
          hint="(اصلاح: منفی هم مجاز است)"
          error={state.fieldErrors?.amount}
        >
          <Input
            id={`inv-amount-${variant.id}`}
            name="amount"
            dir="ltr"
            className="text-start"
            inputMode="numeric"
            placeholder="10"
            required
          />
        </AdminField>
        <AdminField
          id={`inv-reason-${variant.id}`}
          label="دلیل"
          hint="(برای اصلاح الزامی)"
          error={state.fieldErrors?.reason}
        >
          <Input
            id={`inv-reason-${variant.id}`}
            name="reason"
            maxLength={200}
            placeholder="مثلاً: شمارش انبار"
          />
        </AdminField>
      </div>

      <AdminFormFeedback message={state.message} error={state.error} />

      <div className="flex items-center gap-3">
        <AdminSubmitButton pending={pending}>
          {pending ? "در حال ثبت..." : "ثبت تغییر موجودی"}
        </AdminSubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
        >
          بستن
        </button>
      </div>

      {justSaved && (
        <p className="text-xs text-muted-foreground" role="status">
          آخرین ثبت با موفقیت انجام شد.
        </p>
      )}
    </form>
  );
}

export function DeleteVariantButton({ productId, variant }: { productId: string; variant: AdminVariantDetail }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<ProductActionState, FormData>(deleteVariantAction, {});

  const removable = variant.orderItemCount === 0 && variant.cartItemCount === 0;

  if (!removable) {
    return (
      <span className="text-[11px] text-muted-foreground">
        {variant.orderItemCount > 0 ? "دارای سابقه سفارش" : "در سبد خرید مشتری"}
      </span>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className="space-y-1"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant.id} />
      {armed ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">حذف قطعی؟</span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            تأیید
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            انصراف
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex h-8 items-center rounded-md border border-destructive/30 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          حذف گونه
        </button>
      )}
      {state.error && <p className="text-xs text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}