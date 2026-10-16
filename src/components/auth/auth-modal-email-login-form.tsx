"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { loginWithEmail } from "@/app/actions/auth";
import {
  initialEmailLoginState,
  type EmailLoginFormState,
} from "@/lib/auth/form-state";
import { Input } from "@/components/ui/input";
import { useAuthModal } from "./auth-modal-context";

export function AuthModalEmailLoginForm() {
  const router = useRouter();
  const { closeModal } = useAuthModal();

  const [state, formAction, pending] = useActionState<EmailLoginFormState, FormData>(
    loginWithEmail,
    initialEmailLoginState
  );

  // The server sets `success` only after createSession() resolved, so this
  // never fires on mount the way a "no error" check would.
  React.useEffect(() => {
    if (!state.success) return;
    closeModal();
    router.refresh();
  }, [state.success, closeModal, router]);

  const fieldErrors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="modal-email-login" className="mb-1.5 block text-sm font-medium text-foreground">
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
            id="modal-email-login"
            name="email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="email"
            placeholder="you@example.com"
            className="ps-9 text-start"
            required
            aria-invalid={fieldErrors?.email ? true : undefined}
          />
        </div>
        {fieldErrors?.email && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="modal-password-login" className="mb-1.5 block text-sm font-medium text-foreground">
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
            id="modal-password-login"
            name="password"
            type="password"
            autoComplete="current-password"
            className="ps-9 text-start"
            required
            aria-invalid={fieldErrors?.password ? true : undefined}
          />
        </div>
        {fieldErrors?.password && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
        )}
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-[#042e3a] text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(4,46,58,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/30 after:to-transparent after:transition-transform after:duration-700 hover:bg-[#083f52] hover:shadow-[0_8px_32px_-6px_rgba(14,165,200,0.5)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
      >
        {pending ? "در حال ورود…" : "ورود با ایمیل"}
      </button>

      <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        اگر با شماره موبایل ثبت‌نام کرده‌اید، از تب «شماره موبایل» و کد پیامک‌شده
        وارد شوید.
      </p>
    </form>
  );
}