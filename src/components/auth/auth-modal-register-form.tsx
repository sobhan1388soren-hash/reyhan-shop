"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { requestRegisterOtp, verifyRegisterOtp } from "@/app/actions/auth";
import { initialAuthState, type AuthFormState } from "@/lib/auth/form-state";
import { OtpStep } from "@/components/auth/otp-step";
import { Input } from "@/components/ui/input";
import { useAuthModal } from "./auth-modal-context";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function AuthModalRegisterForm() {
  const router = useRouter();
  const { closeModal } = useAuthModal();

  const [requestState, requestAction, requestPending] = useActionState<AuthFormState, FormData>(
    requestRegisterOtp,
    initialAuthState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState<AuthFormState, FormData>(
    verifyRegisterOtp,
    initialAuthState
  );

  const [forcePhoneStep, setForcePhoneStep] = React.useState(false);
  const otpRequested = requestState.step === "otp" && requestState.phone != null;
  const verifyBounced = verifyState.step === "phone" && verifyState.error != null;
  const step: "phone" | "otp" =
    otpRequested && !verifyBounced && !forcePhoneStep ? "otp" : "phone";

  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [code, setCode] = React.useState("");

  const handleResend = React.useCallback(async () => {
    const fd = new FormData();
    fd.set("firstName", form.firstName);
    fd.set("lastName", form.lastName);
    fd.set("email", form.email);
    fd.set("phone", form.phone);
    await requestRegisterOtp(initialAuthState, fd);
  }, [form]);

  const handleSuccess = React.useCallback(() => {
    closeModal();
    router.refresh();
  }, [closeModal, router]);

  React.useEffect(() => {
    if (verifyState.step === "phone" && !verifyState.error && !verifyBounced) {
      handleSuccess();
    }
  }, [verifyState.step, verifyState.error, verifyBounced, handleSuccess]);

  if (step === "otp") {
    return (
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="phone" value={requestState.phone ?? form.phone} />
        <input
          type="hidden"
          name="requestId"
          value={requestState.fieldErrors?.requestId ?? ""}
        />
        <OtpStep
          phone={requestState.phone ?? form.phone}
          onBack={() => {
            setForcePhoneStep(true);
            setCode("");
          }}
          onRequestResend={handleResend}
          value={code}
          onChange={setCode}
          error={verifyState.error}
          attemptsLeft={verifyState.attemptsLeft}
          disabled={verifyPending}
        />
        <button
          type="submit"
          disabled={verifyPending || code.length !== 6}
          className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] text-sm font-semibold text-[#042e3a] shadow-[0_8px_24px_-6px_rgba(0,245,160,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/40 after:to-transparent after:transition-transform after:duration-700 hover:shadow-[0_8px_32px_-6px_rgba(0,245,160,0.6)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
        >
          {verifyPending ? "در حال بررسی…" : "تأیید و تکمیل ثبت‌نام"}
        </button>
      </form>
    );
  }

  const fieldErrors = requestState.fieldErrors;

  return (
    <form action={requestAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="modal-firstName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام
          </label>
          <Input
            id="modal-firstName"
            name="firstName"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            autoComplete="given-name"
            required
          />
          <FieldError message={fieldErrors?.firstName} />
        </div>
        <div>
          <label htmlFor="modal-lastName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام خانوادگی
          </label>
          <Input
            id="modal-lastName"
            name="lastName"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
          />
          <FieldError message={fieldErrors?.lastName} />
        </div>
      </div>

      <div>
        <label htmlFor="modal-reg-phone" className="mb-1.5 block text-sm font-medium text-foreground">
          شماره موبایل
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d="M3 2.5h3l1.5 3.5-2 1.5a10 10 0 0 0 4 4l1.5-2 3.5 1.5v3a1.5 1.5 0 0 1-1.7 1.5C7.4 15.5.5 8.6.5 3.2A1.5 1.5 0 0 1 2 2.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <Input
            id="modal-reg-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            className="ps-9 text-center tracking-wider"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>
        <FieldError message={fieldErrors?.phone} />
      </div>

      <div>
        <label htmlFor="modal-email" className="mb-1.5 block text-sm font-medium text-foreground">
          ایمیل <span className="font-normal text-muted-foreground">(اختیاری)</span>
        </label>
        <Input
          id="modal-email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <FieldError message={fieldErrors?.email} />
      </div>

      {(requestState.error || verifyState.error) && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {requestState.error ?? verifyState.error}
        </p>
      )}

      <button
        type="submit"
        disabled={requestPending}
        onClick={() => setForcePhoneStep(false)}
        className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-l from-[#22d3ee] to-[#00f5a0] text-sm font-semibold text-[#042e3a] shadow-[0_8px_24px_-6px_rgba(0,245,160,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/40 after:to-transparent after:transition-transform after:duration-700 hover:shadow-[0_8px_32px_-6px_rgba(0,245,160,0.6)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
      >
        {requestPending ? "در حال ارسال…" : "ثبت‌نام و ایجاد حساب"}
      </button>
    </form>
  );
}
