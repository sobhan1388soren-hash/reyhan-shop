"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createDiscountAction,
  updateDiscountAction,
  type DiscountActionState,
} from "@/app/actions/discounts";
import { DISCOUNT_CODE_MAX } from "@/lib/admin/discount-admin-rules";
import type { AdminDiscountDetail } from "@/lib/admin/discount-admin-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFormFeedback,
  AdminFormSection,
  AdminSubmitButton,
  adminSelectClass,
} from "@/components/admin/admin-form";

// DiscountForm — grouped create/edit form. All rules are validated
// server-side by the existing discount service + admin validation; this
// island only handles the type-dependent value field and submission.

export type DiscountDraft = {
  code: string;
  type: string;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  maxUses: string;
  maxUsesPerUser: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export const emptyDiscountDraft: DiscountDraft = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  maxUses: "",
  maxUsesPerUser: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function tomanField(rial: number | null): string {
  if (rial == null) return "";
  return String(Math.round(rial / 10));
}

export function draftFromDiscount(discount: AdminDiscountDetail): DiscountDraft {
  return {
    code: discount.code,
    type: discount.type,
    value:
      discount.type === "PERCENTAGE"
        ? String(discount.value)
        : discount.type === "FIXED_AMOUNT"
          ? tomanField(discount.value)
          : "",
    minOrderAmount: tomanField(discount.minOrderAmount),
    maxDiscountAmount: tomanField(discount.maxDiscountAmount),
    maxUses: discount.maxUses != null ? String(discount.maxUses) : "",
    maxUsesPerUser: discount.maxUsesPerUser != null ? String(discount.maxUsesPerUser) : "",
    startsAt: toDateInput(discount.startsAt),
    endsAt: toDateInput(discount.endsAt),
    isActive: discount.isActive,
  };
}

export function DiscountForm({
  mode,
  discountId,
  draft: initialDraft,
}: {
  mode: "create" | "edit";
  discountId?: string;
  draft: DiscountDraft;
}) {
  const isEdit = mode === "edit";
  const [state, action, pending] = useActionState<DiscountActionState, FormData>(
    isEdit ? updateDiscountAction : createDiscountAction,
    {}
  );
  const [type, setType] = React.useState(initialDraft.type);

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="discountId" value={discountId} />}

      <AdminFormSection title="اطلاعات کد تخفیف">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField id="d-code" label="کد تخفیف" error={state.fieldErrors?.code}>
            <Input
              id="d-code"
              name="code"
              dir="ltr"
              className="text-start"
              maxLength={DISCOUNT_CODE_MAX}
              defaultValue={initialDraft.code}
              placeholder="REYHAN10"
              required
            />
          </AdminField>
          <AdminField id="d-type" label="نوع تخفیف" error={state.fieldErrors?.type}>
            <select
              id="d-type"
              name="type"
              className={adminSelectClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="PERCENTAGE">درصدی</option>
              <option value="FIXED_AMOUNT">مبلغ ثابت</option>
              <option value="FREE_SHIPPING">ارسال رایگان</option>
            </select>
          </AdminField>
        </div>

        {type === "PERCENTAGE" && (
          <div className="mt-4 sm:max-w-xs">
            <AdminField id="d-value" label="درصد تخفیف (٪)" error={state.fieldErrors?.value}>
              <Input
                id="d-value"
                name="value"
                dir="ltr"
                className="text-start"
                inputMode="numeric"
                defaultValue={initialDraft.value}
                placeholder="مثلاً ۱۰"
                required
              />
            </AdminField>
          </div>
        )}
        {type === "FIXED_AMOUNT" && (
          <div className="mt-4 sm:max-w-xs">
            <AdminField id="d-value" label="مبلغ تخفیف (تومان)" error={state.fieldErrors?.value}>
              <Input
                id="d-value"
                name="value"
                dir="ltr"
                className="text-start"
                inputMode="numeric"
                defaultValue={initialDraft.value}
                placeholder="مثلاً ۵۰٬۰۰۰"
                required
              />
            </AdminField>
          </div>
        )}
        {type === "FREE_SHIPPING" && (
          <p className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            این نوع تخفیف هزینه ارسال سفارش را رایگان می‌کند و مبلغ تخفیف کالا ندارد.
          </p>
        )}
      </AdminFormSection>

      <AdminFormSection title="شرایط استفاده">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField
            id="d-min"
            label="حداقل مبلغ سفارش (تومان)"
            hint="(اختیاری)"
            error={state.fieldErrors?.minOrderAmount}
          >
            <Input
              id="d-min"
              name="minOrderAmount"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.minOrderAmount}
            />
          </AdminField>
          <AdminField
            id="d-max"
            label="سقف مبلغ تخفیف (تومان)"
            hint="(اختیاری — برای درصدی)"
            error={state.fieldErrors?.maxDiscountAmount}
          >
            <Input
              id="d-max"
              name="maxDiscountAmount"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.maxDiscountAmount}
            />
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormSection title="محدودیت استفاده">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField
            id="d-maxuses"
            label="سقف کل استفاده"
            hint="(خالی = نامحدود)"
            error={state.fieldErrors?.maxUses}
          >
            <Input
              id="d-maxuses"
              name="maxUses"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.maxUses}
            />
          </AdminField>
          <AdminField
            id="d-maxperuser"
            label="سقف استفاده هر کاربر"
            hint="(خالی = نامحدود)"
            error={state.fieldErrors?.maxUsesPerUser}
          >
            <Input
              id="d-maxperuser"
              name="maxUsesPerUser"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.maxUsesPerUser}
            />
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormSection title="بازه اعتبار">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField
            id="d-start"
            label="تاریخ شروع"
            hint="(اختیاری)"
            error={state.fieldErrors?.startsAt}
          >
            <Input
              id="d-start"
              name="startsAt"
              type="date"
              dir="ltr"
              className="text-start"
              defaultValue={initialDraft.startsAt}
            />
          </AdminField>
          <AdminField
            id="d-end"
            label="تاریخ پایان"
            hint="(اختیاری)"
            error={state.fieldErrors?.endsAt}
          >
            <Input
              id="d-end"
              name="endsAt"
              type="date"
              dir="ltr"
              className="text-start"
              defaultValue={initialDraft.endsAt}
            />
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormSection title="وضعیت">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={initialDraft.isActive}
            className="size-4 accent-[var(--reyhan-blue-600)]"
          />
          کد تخفیف فعال باشد
        </label>
      </AdminFormSection>

      <AdminFormFeedback message={state.message} error={state.error} />

      <AdminSubmitButton pending={pending}>
        {pending ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ثبت کد تخفیف"}
      </AdminSubmitButton>
    </form>
  );
}