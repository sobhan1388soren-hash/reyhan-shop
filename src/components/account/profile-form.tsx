"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateProfile } from "@/app/actions/auth";
import type { ProfileFormState } from "@/lib/auth/form-state";
import { Input } from "@/components/ui/input";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
  };
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-firstName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام
          </label>
          <Input
            id="p-firstName"
            name="firstName"
            defaultValue={initial.firstName}
            autoComplete="given-name"
          />
          <FieldError message={state.fieldErrors?.firstName} />
        </div>
        <div>
          <label htmlFor="p-lastName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام خانوادگی
          </label>
          <Input
            id="p-lastName"
            name="lastName"
            defaultValue={initial.lastName}
            autoComplete="family-name"
          />
          <FieldError message={state.fieldErrors?.lastName} />
        </div>
      </div>

      <div>
        <label htmlFor="p-displayName" className="mb-1.5 block text-sm font-medium text-foreground">
          نام نمایشی
        </label>
        <Input
          id="p-displayName"
          name="displayName"
          defaultValue={initial.displayName}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          این نام در دیدگاه‌ها و پرسش‌های شما نمایش داده می‌شود.
        </p>
        <FieldError message={state.fieldErrors?.displayName} />
      </div>

      <div>
        <label htmlFor="p-email" className="mb-1.5 block text-sm font-medium text-foreground">
          ایمیل <span className="font-normal text-muted-foreground">(اختیاری)</span>
        </label>
        <Input
          id="p-email"
          name="email"
          type="email"
          dir="ltr"
          defaultValue={initial.email}
          autoComplete="email"
        />
        <FieldError message={state.fieldErrors?.email} />
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
      </button>
    </form>
  );
}
