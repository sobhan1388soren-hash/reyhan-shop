"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  requestRegisterOtp,
  verifyRegisterOtp,
} from "@/app/actions/auth";
import { initialAuthState, type AuthFormState } from "@/lib/auth/form-state";
import { OtpStep } from "@/components/auth/otp-step";
import { Input } from "@/components/ui/input";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function RegisterForm() {
  const [requestState, requestAction, requestPending] = useActionState<
    AuthFormState,
    FormData
  >(requestRegisterOtp, initialAuthState);

  const [verifyState, verifyAction, verifyPending] = useActionState<
    AuthFormState,
    FormData
  >(verifyRegisterOtp, initialAuthState);

  // Step derives from server state — no effect syncing. Local override lets
  // the user return to the registration form ("تغییر شماره").
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
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
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
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام
          </label>
          <Input
            id="firstName"
            name="firstName"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            autoComplete="given-name"
            required
          />
          <FieldError message={fieldErrors?.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-foreground">
            نام خانوادگی
          </label>
          <Input
            id="lastName"
            name="lastName"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
          />
          <FieldError message={fieldErrors?.lastName} />
        </div>
      </div>

      <div>
        <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-foreground">
          شماره موبایل
        </label>
        <Input
          id="reg-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          className="text-center tracking-wider"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          شماره موبایل، شناسه حساب شما در ریحان است و برای ورود و اطلاع‌رسانی سفارش‌ها
          استفاده می‌شود.
        </p>
        <FieldError message={fieldErrors?.phone} />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
          ایمیل <span className="font-normal text-muted-foreground">(اختیاری)</span>
        </label>
        <Input
          id="email"
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
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requestPending ? "در حال ارسال…" : "دریافت کد تأیید"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        قبلاً حساب دارید؟{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--reyhan-blue-700)] hover:underline"
        >
          ورود
        </Link>
      </p>
    </form>
  );
}
