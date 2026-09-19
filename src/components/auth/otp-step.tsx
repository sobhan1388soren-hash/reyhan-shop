"use client";

// Shared OTP input + resend countdown — used by login and register forms.

import * as React from "react";
import { toFaDigits } from "@/lib/catalog/format";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/constants";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OtpStepProps = {
  phone: string;
  onBack: () => void;
  onRequestResend: () => Promise<void> | void;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  attemptsLeft?: number;
  disabled?: boolean;
};

export function OtpStep({
  phone,
  onBack,
  onRequestResend,
  value,
  onChange,
  error,
  attemptsLeft,
  disabled,
}: OtpStepProps) {
  const [cooldown, setCooldown] = React.useState(OTP_RESEND_COOLDOWN_SECONDS);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    await onRequestResend();
    setResent(true);
    setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        کد تأیید ۶ رقمی به شماره{" "}
        <span className="font-semibold text-foreground" dir="ltr">
          {phone}
        </span>{" "}
        پیامک شد. کد تا{" "}
        <span className="font-semibold text-foreground">{toFaDigits(2)} دقیقه</span> اعتبار دارد.
      </div>

      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-foreground">
          کد تأیید
        </label>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="------"
          className="text-center text-lg tracking-[0.5em] tabular-nums"
          disabled={disabled}
          required
          autoFocus
        />
        {attemptsLeft != null && attemptsLeft > 0 && !error && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {toFaDigits(attemptsLeft)} تلاش باقی مانده است.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-[var(--reyhan-blue-700)] hover:underline"
        >
          تغییر شماره
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className={cn(
            "font-medium",
            cooldown > 0
              ? "cursor-not-allowed text-muted-foreground"
              : "text-[var(--reyhan-blue-700)] hover:underline"
          )}
        >
          {cooldown > 0
            ? `ارسال مجدد کد تا ${toFaDigits(cooldown)} ثانیه دیگر`
            : "ارسال مجدد کد"}
        </button>
      </div>
      {resent && cooldown > 0 && (
        <p className="text-xs text-[var(--reyhan-green-700)]" role="status">
          کد جدید پیامک شد.
        </p>
      )}
    </div>
  );
}
