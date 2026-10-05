"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { requestLoginOtp, verifyLoginOtp } from "@/app/actions/auth";
import { initialAuthState, type AuthFormState } from "@/lib/auth/form-state";
import { OtpStep } from "@/components/auth/otp-step";
import { Input } from "@/components/ui/input";
import { toFaDigits } from "@/lib/catalog/format";
import { useAuthModal } from "./auth-modal-context";

export function AuthModalLoginForm() {
  const router = useRouter();
  const { closeModal } = useAuthModal();

  const [requestState, requestAction, requestPending] = useActionState<AuthFormState, FormData>(
    requestLoginOtp,
    initialAuthState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState<AuthFormState, FormData>(
    verifyLoginOtp,
    initialAuthState
  );

  const [forcePhoneStep, setForcePhoneStep] = React.useState(false);
  const otpRequested = requestState.step === "otp" && requestState.phone != null;
  const verifyBounced = verifyState.step === "phone" && verifyState.error != null;
  const step: "phone" | "otp" =
    otpRequested && !verifyBounced && !forcePhoneStep ? "otp" : "phone";

  const [phoneDraft, setPhoneDraft] = React.useState("");
  const [code, setCode] = React.useState("");
  const phone = step === "otp" ? (requestState.phone ?? phoneDraft) : phoneDraft;

  const handleResend = React.useCallback(async () => {
    if (!phone) return;
    const fd = new FormData();
    fd.set("phone", phone);
    await requestLoginOtp(initialAuthState, fd);
  }, [phone]);

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
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value="/account" />
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
          className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-[#042e3a] text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(4,46,58,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/30 after:to-transparent after:transition-transform after:duration-700 hover:bg-[#083f52] hover:shadow-[0_8px_32px_-6px_rgba(14,165,200,0.5)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
        >
          {verifyPending ? "در حال بررسی…" : "تأیید و ورود"}
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      <input type="hidden" name="next" value="/account" />
      <div>
        <label htmlFor="modal-phone" className="mb-1.5 block text-sm font-medium text-foreground">
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
            id="modal-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            className="ps-9 text-center tracking-wider"
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            required
            autoFocus
          />
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          برای ورود، شماره موبایل ثبت‌شده در حساب ریحان را وارد کنید.
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
        className="relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-[#042e3a] text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(4,46,58,0.4)] transition-all duration-300 after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/30 after:to-transparent after:transition-transform after:duration-700 hover:bg-[#083f52] hover:shadow-[0_8px_32px_-6px_rgba(14,165,200,0.5)] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:after:translate-x-full"
      >
        {requestPending ? "در حال ارسال…" : "ورود به حساب کاربری"}
      </button>

      <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        نکته امنیتی: کد ورود فقط از طریق پیامک برای شما ارسال می‌شود. اعتبار کد{" "}
        {toFaDigits(2)} دقیقه است.
      </p>
    </form>
  );
}
