import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "ثبت‌نام",
  description: "ساخت حساب کاربری در فروشگاه ریحان با شماره موبایل و تأیید پیامکی.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
            <path
              d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.5 0-7 1.8-7 4v1.5h14V18c0-2.2-3.5-4-7-4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">ساخت حساب کاربری</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          در چند دقیقه عضو ریحان شوید؛ فقط به شماره موبایل شما نیاز داریم.
        </p>
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        با ثبت‌نام،{" "}
        <Link href="/terms" className="hover:underline">
          قوانین و مقررات
        </Link>{" "}
        ریحان را می‌پذیرید.
      </p>
    </div>
  );
}
