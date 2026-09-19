"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createAddress,
  updateAddress,
} from "@/app/actions/addresses";
import type { AddressFormState } from "@/lib/auth/form-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: AddressFormState = {};

type AddressDraft = {
  id?: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
};

const emptyDraft: AddressDraft = {
  recipientName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  addressLine: "",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function AddressForm({
  draft,
  onClose,
  onSaved,
}: {
  draft: AddressDraft;
  onClose: () => void;
  /** Called once after a successful save (checkout listens to select the new address). */
  onSaved?: () => void;
}) {
  const isEdit = Boolean(draft.id);
  const [state, action, pending] = useActionState<AddressFormState, FormData>(
    isEdit ? updateAddress : createAddress,
    initial
  );

  // Close the form after a successful save.
  const justSaved = state.message != null;
  React.useEffect(() => {
    if (justSaved) {
      onSaved?.();
      const timer = setTimeout(() => onClose(), 600);
      return () => clearTimeout(timer);
    }
  }, [justSaved, onClose, onSaved]);

  return (
    <form action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="addressId" value={draft.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-recipient" className="mb-1.5 block text-sm font-medium text-foreground">
            نام گیرنده
          </label>
          <Input id="a-recipient" name="recipientName" defaultValue={draft.recipientName} required />
          <FieldError message={state.fieldErrors?.recipientName} />
        </div>
        <div>
          <label htmlFor="a-phone" className="mb-1.5 block text-sm font-medium text-foreground">
            شماره تماس گیرنده
          </label>
          <Input
            id="a-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            className="text-center"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            defaultValue={draft.phone}
            required
          />
          <FieldError message={state.fieldErrors?.phone} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-province" className="mb-1.5 block text-sm font-medium text-foreground">
            استان
          </label>
          <Input id="a-province" name="province" defaultValue={draft.province} required />
          <FieldError message={state.fieldErrors?.province} />
        </div>
        <div>
          <label htmlFor="a-city" className="mb-1.5 block text-sm font-medium text-foreground">
            شهر
          </label>
          <Input id="a-city" name="city" defaultValue={draft.city} required />
          <FieldError message={state.fieldErrors?.city} />
        </div>
      </div>

      <div>
        <label htmlFor="a-postal" className="mb-1.5 block text-sm font-medium text-foreground">
          کد پستی <span className="font-normal text-muted-foreground">(اختیاری)</span>
        </label>
        <Input
          id="a-postal"
          name="postalCode"
          inputMode="numeric"
          dir="ltr"
          maxLength={10}
          className="text-center tracking-wider"
          placeholder="۱۰ رقم"
          defaultValue={draft.postalCode}
        />
        <FieldError message={state.fieldErrors?.postalCode} />
      </div>

      <div>
        <label htmlFor="a-line" className="mb-1.5 block text-sm font-medium text-foreground">
          نشانی کامل
        </label>
        <textarea
          id="a-line"
          name="addressLine"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="خیابان، کوچه، پلاک، واحد"
          defaultValue={draft.addressLine}
          required
        />
        <FieldError message={state.fieldErrors?.addressLine} />
      </div>

      {state.message && (
        <p className="rounded-md bg-[var(--reyhan-green-50)] px-3 py-2 text-sm text-[var(--reyhan-green-700)]" role="status">
          {state.message}
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ثبت نشانی"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-md border border-input px-6 text-sm font-medium transition-colors hover:bg-accent"
          )}
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

export type { AddressDraft };
export { emptyDraft };
