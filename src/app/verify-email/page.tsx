"use client";

import * as React from "react";
import Link from "next/link";
import { resendVerificationEmail, verifyEmail } from "@/app/actions/auth";

type PageState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | { status: "expired"; message: string; email: string };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [state, setState] = React.useState<PageState>({ status: "loading", message: "" });
  const [resending, setResending] = React.useState(false);
  const [resendNote, setResendNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const params = await searchParams;
      const token = params.token ?? "";

      if (!token) {
        setState({ status: "error", message: "پیوند تأیید نامعتبر است." });
        return;
      }

      const formData = new FormData();
      formData.set("token", token);

      const result = await verifyEmail(null, formData);

      if (result.success) {
        setState({
          status: "success",
          message: "ایمیل شما با موفقیت تأیید شد. اکنون می‌توانید وارد حساب خود شوید.",
        });
      } else if (result.expired && result.email) {
        setState({ status: "expired", message: result.error ?? "پیوند تأیید منقضی شده است.", email: result.email });
      } else {
        setState({
          status: "error",
          message: result.error ?? "خطا در تأیید ایمیل.",
        });
      }
    })();
  }, [searchParams]);

  async function handleResend() {
    if (state.status !== "expired" || resending) return;
    setResending(true);
    setResendNote(null);
    try {
      const formData = new FormData();
      formData.set("email", state.email);
      const result = await resendVerificationEmail(null, formData);
      setResendNote(result.success ? (result.message ?? "پیوند جدید ارسال شد.") : (result.error ?? "خطا در ارسال پیوند جدید."));
    } catch {
      setResendNote("خطا در ارسال پیوند جدید. لطفاً دوباره تلاش کنید.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">در حال تأیید ایمیل…</p>
          </div>
        )}

        {state.status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-green-600" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">ایمیل تأیید شد</h1>
            <p className="text-muted-foreground">{state.message}</p>
            <Link
              href="/login"
              className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
            >
              ورود به حساب
            </Link>
          </div>
        )}

        {state.status === "expired" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-amber-600" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">پیوند منقضی شده است</h1>
            <p className="text-muted-foreground">{state.message}</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? "در حال ارسال…" : "دریافت پیوند جدید"}
            </button>
            {resendNote && <p className="text-sm text-muted-foreground">{resendNote}</p>}
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-red-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-red-600" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">خطا در تأیید</h1>
            <p className="text-muted-foreground">{state.message}</p>
            <div className="mt-2 flex gap-3">
              <Link
                href="/register"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
              >
                ثبت‌نام مجدد
              </Link>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
              >
                ورود
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
