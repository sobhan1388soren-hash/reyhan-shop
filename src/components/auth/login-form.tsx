"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  requestLoginOtp,
  verifyLoginOtp,
} from "@/app/actions/auth";
import { initialAuthState, type AuthFormState } from "@/lib/auth/form-state";
import { OtpStep } from "@/components/auth/otp-step";
import { Input } from "@/components/ui/input";
import { toFaDigits } from "@/lib/catalog/format";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [requestState, requestAction, requestPending] = useActionState<
    AuthFormState,
    FormData
  >(requestLoginOtp, initialAuthState);

  const [verifyState, verifyAction, verifyPending] = useActionState<
    AuthFormState,
    FormData
  >(verifyLoginOtp, initialAuthState);

  // Step derives from server state — no effect syncing. A local override lets
  // the user go back to the phone step ("تغییر شماره") before re-requesting.
  const [forcePhoneStep, setForcePhoneStep] = React.useState(false);
  const otpRequested = requestState.step === "otp" && requestState.phone != null;
  const verifyBounced = verifyState.step === "phone" && verifyState.error != null;
  const step: "phone" | "otp" =
    otpRequested && !verifyBounced && !forcePhoneStep ? "otp" : "phone";

  // Keep the phone visible for the OTP form; track local edits only in the
  // phone step so the OTP step shows the verified number from the server.
  const [phoneDraft, setPhoneDraft] = React.useState("");
  const [code, setCode] = React.useState("");
  const phone = step === "otp" ? (requestState.phone ?? phoneDraft) : phoneDraft;

  const handleResend = React.useCallback(async () => {
    if (!phone) return;
    const fd = new FormData();
    fd.set("phone", phone);
    await requestLoginOtp(initialAuthState, fd);
  }, [phone]);

  if (step === "otp") {
    return (
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={nextPath} />
        <OtpStep
          phone={phone}
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
          {verifyPending ? "در حال بررسی…" : "تأیید و ورود"}
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
          شماره موبایل
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          className="text-center tracking-wider"
          value={phoneDraft}
          onChange={(e) => setPhoneDraft(e.target.value)}
          required
          autoFocus
        />
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          برای ورود، شماره موبایل ثبت‌شده در حساب ریحان را وارد کنید. یک کد یک‌بارمصرف
          برای شما پیامک می‌شود.
        </p>
      </div>

      {requestState.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {requestState.error}
        </p>
      )}

      <button
        type="submit"
        disabled={requestPending}
        onClick={() => setForcePhoneStep(false)}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requestPending ? "در حال ارسال…" : "دریافت کد ورود"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        حساب کاربری ندارید؟{" "}
        <Link
          href="/register"
          className="font-semibold text-[var(--reyhan-blue-700)] hover:underline"
        >
          ثبت‌نام
        </Link>
      </p>

      <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        نکته امنیتی: کد ورود فقط از طریق پیامک برای شما ارسال می‌شود و هرگز از شما
        درخواست نمی‌شود که آن را با دیگران به اشتراک بگذارید. اعتبار کد{" "}
        {toFaDigits(2)} دقیقه است.
      </p>
    </form>
  );
}
