import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری ریحان با شماره موبایل و کد یک‌بارمصرف.",
  alternates: { canonical: "/login" },
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  // Only accept internal paths (validated again server-side in the action).
  const raw = resolved.next ?? "/account";
  const nextPath = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
            <path
              d="M12 4.5C12 4.5 6 10 6 14a6 6 0 0 0 12 0c0-4-6-9.5-6-9.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">ورود به ریحان</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          با شماره موبایل و کد یک‌بارمصرف، سریع و امن وارد شوید.
        </p>
      </div>

      <LoginForm nextPath={nextPath} />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        با ورود،{" "}
        <Link href="/terms" className="hover:underline">
          قوانین و مقررات
        </Link>{" "}
        ریحان را می‌پذیرید.
      </p>
    </div>
  );
}
