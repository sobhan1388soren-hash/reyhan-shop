"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { registerWithEmail } from "@/app/actions/auth";
import {
  initialEmailRegisterState,
  type EmailRegisterFormState,
} from "@/lib/auth/form-state";
import { normalizeNationalCode, PASSWORD_MIN } from "@/lib/auth/email-rules";
import { Input } from "@/components/ui/input";
import { toFaDigits } from "@/lib/catalog/format";
import { useAuthModal } from "./auth-modal-context";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function AuthModalEmailRegisterForm() {
  const router = useRouter();
  const { closeModal } = useAuthModal();

  const [state, formAction, pending] = useActionState<EmailRegisterFormState, FormData>(
    registerWithEmail,
    initialEmailRegisterState
  );

  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    nationalCode: "",
  });

  React.useEffect(() => {
    if (state.step !== "email" || !state.success) return;
    closeModal();
    router.refresh();
  }, [state, closeModal, router]);

  const fieldErrors = state.fieldErrors;

  if (state.step === "email_pending") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--reyhan-green-50)]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-[var(--reyhan-green-600)]" fill="none">
            <path
              d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="m22 6--8 5-8-5M10 21V11h8v10"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">ایمیل تأیید ارسال شد</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {state.message ?? "ایمیل تأیید به آدرس شما ارسال شد. لطفاً ایمیل خود را بررسی کنید و روی پیوند تأیید کلیک کنید."}
          </p>
        </div>
        <button
          type="button"
          onClick={closeModal}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          بستن
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="modal-email-reg-firstName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام
          </label>
          <Input
            id="modal-email-reg-firstName"
            name="firstName"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            aria-invalid={fieldErrors?.firstName ? true : undefined}
            required
          />
          <FieldError message={fieldErrors?.firstName} />
        </div>
        <div>
          <label htmlFor="modal-email-reg-lastName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام خانوادگی
          </label>
          <Input
            id="modal-email-reg-lastName"
            name="lastName"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            aria-invalid={fieldErrors?.lastName ? true : undefined}
          />
          <FieldError message={fieldErrors?.lastName} />
        </div>
      </div>

      <div>
        <label htmlFor="modal-email-reg" className="mb-1.5 block text-sm font-medium text-foreground">
          ایمیل
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="m2 4.5 6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </span>
          <Input
            id="modal-email-reg"
            name="email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="email"
            placeholder="you@example.com"
            className="ps-9 text-start"
            aria-invalid={fieldErrors?.email ? true : undefined}
            required
          />
        </div>
        <FieldError message={fieldErrors?.email} />
      </div>

      <div>
        <label htmlFor="modal-email-reg-password" className="mb-1.5 block text-sm font-medium text-foreground">
          رمز عبور
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
          <Input
            id="modal-email-reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="ps-9 text-start"
            aria-invalid={fieldErrors?.password ? true : undefined}
            required
          />
        </div>
        <FieldError message={fieldErrors?.password} />
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          حداقل {toFaDigits(PASSWORD_MIN)} نویسه.
        </p>
      </div>

      <div>
        <label htmlFor="modal-email-reg-nationalCode" className="mb-1.5 block text-sm font-medium text-foreground">
          کد ملی
        </label>
        <Input
          id="modal-email-reg-nationalCode"
          name="nationalCode"
          inputMode="numeric"
          dir="ltr"
          maxLength={12}
          placeholder="۰۰۱۲۳۴۵۶۷۸"
          className="text-center tracking-widest tabular-nums"
          value={form.nationalCode}
          onChange={(e) =>
            setForm({ ...form, nationalCode: normalizeNationalCode(e.target.value) })
          }
          aria-invalid={fieldErrors?.nationalCode ? true : undefined}
          required
        />
        <FieldError message={fieldErrors?.nationalCode} />
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          کد ملی به‌عنوان شناسه دائمی حساب ثبت می‌شود و امکان ثبت‌نام دوباره با آن
          وجود ندارد.
        </p>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] text-sm font-semibold text-[#042e3a] shadow-[0_8px_24px_-6px_rgba(0,245,160,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/40 after:to-transparent after:transition-transform after:duration-700 hover:shadow-[0_8px_32px_-6px_rgba(0,245,160,0.6)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
      >
        {pending ? "در حال ثبت‌نام…" : "ایجاد حساب با ایمیل"}
      </button>
    </form>
  );
}