"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createSpecificationAction,
  updateSpecificationAction,
  deleteSpecificationAction,
  type ProductActionState,
} from "@/app/actions/products";
import { SPEC_KEY_MAX, SPEC_VALUE_MAX } from "@/lib/admin/product-rules";
import type { AdminProductDetail } from "@/lib/admin/product-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFormFeedback,
  AdminSubmitButton,
} from "@/components/admin/admin-form";
import { toFaDigits } from "@/lib/catalog/format";

// SpecificationManager — structured key/value attributes (descriptive, not
// selectable). The schema enforces @@unique([productId, key]); duplicate
// keys are rejected server-side with Persian copy. No attribute/template
// system is introduced.

type SpecRow = AdminProductDetail["specifications"][number];

function SpecEditForm({
  productId,
  spec,
  onCancel,
}: {
  productId: string;
  spec: SpecRow;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    updateSpecificationAction,
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
      <input type="hidden" name="specificationId" value={spec.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField id={`s-key-${spec.id}`} label="عنوان ویژگی" error={state.fieldErrors?.key}>
          <Input
            id={`s-key-${spec.id}`}
            name="key"
            defaultValue={spec.key}
            maxLength={SPEC_KEY_MAX}
            required
          />
        </AdminField>
        <AdminField id={`s-value-${spec.id}`} label="مقدار" error={state.fieldErrors?.value}>
          <Input
            id={`s-value-${spec.id}`}
            name="value"
            defaultValue={spec.value}
            maxLength={SPEC_VALUE_MAX}
            required
          />
        </AdminField>
      </div>
      <AdminField id={`s-sort-${spec.id}`} label="ترتیب نمایش" error={state.fieldErrors?.sortOrder}>
        <Input
          id={`s-sort-${spec.id}`}
          name="sortOrder"
          dir="ltr"
          className="text-center"
          inputMode="numeric"
          defaultValue={String(spec.sortOrder)}
        />
      </AdminField>
      <AdminFormFeedback message={state.message} error={state.error} />
      <div className="flex items-center gap-3">
        <AdminSubmitButton pending={pending}>{pending ? "در حال ذخیره..." : "ذخیره ویژگی"}</AdminSubmitButton>
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

function DeleteSpecForm({ productId, spec }: { productId: string; spec: SpecRow }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    deleteSpecificationAction,
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
      <input type="hidden" name="specificationId" value={spec.id} />
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

export function SpecificationManager({
  productId,
  specifications,
}: {
  productId: string;
  specifications: SpecRow[];
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    createSpecificationAction,
    {}
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-5">
      {specifications.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          هنوز ویژگی‌ای برای این محصول ثبت نشده است.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="ویژگی‌های محصول">
          {specifications.map((spec) => (
            <li key={spec.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{spec.key}</span>
                    <span className="mx-1 text-muted-foreground">:</span>
                    <span>{spec.value}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">ترتیب {toFaDigits(spec.sortOrder)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingId((id) => (id === spec.id ? null : spec.id))}
                    className="inline-flex h-7 items-center rounded-md border border-input px-2.5 text-[11px] font-medium transition-colors hover:bg-accent"
                  >
                    ویرایش
                  </button>
                  <DeleteSpecForm productId={productId} spec={spec} />
                </div>
              </div>
              {editingId === spec.id && (
                <div className="mt-3">
                  <SpecEditForm productId={productId} spec={spec} onCancel={() => setEditingId(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 rounded-lg border border-dashed p-4">
        <input type="hidden" name="productId" value={productId} />
        <p className="text-sm font-semibold text-foreground">افزودن ویژگی جدید</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField id="s-new-key" label="عنوان ویژگی" error={state.fieldErrors?.key}>
            <Input
              id="s-new-key"
              name="key"
              maxLength={SPEC_KEY_MAX}
              placeholder="مثلاً: ظرفیت"
              required
            />
          </AdminField>
          <AdminField id="s-new-value" label="مقدار" error={state.fieldErrors?.value}>
            <Input
              id="s-new-value"
              name="value"
              maxLength={SPEC_VALUE_MAX}
              placeholder="مثلاً: ۵۰۰ لیتر"
              required
            />
          </AdminField>
        </div>
        <AdminField id="s-new-sort" label="ترتیب نمایش" error={state.fieldErrors?.sortOrder}>
          <Input id="s-new-sort" name="sortOrder" dir="ltr" className="text-center" inputMode="numeric" />
        </AdminField>
        <AdminFormFeedback message={state.message} error={state.error} />
        <AdminSubmitButton pending={pending}>{pending ? "در حال افزودن..." : "افزودن ویژگی"}</AdminSubmitButton>
      </form>
    </div>
  );
}