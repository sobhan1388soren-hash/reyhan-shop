import Link from "next/link";
import { getCurrentUser, userDisplayName } from "@/lib/auth/dal";

// Server component — shows "ورود / ثبت‌نام" for guests and the account link
// with the user's name for authenticated visitors.
export async function HeaderAccountLink() {
  const user = await getCurrentUser();

  return (
    <Link
      href={user ? "/account" : "/login"}
      aria-label={user ? "حساب کاربری من" : "ورود یا ثبت‌نام"}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 20c.8-3.2 3.6-5 7-5s6.2 1.8 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="hidden max-w-[140px] truncate md:inline">
        {user ? userDisplayName(user) : "ورود / ثبت‌نام"}
      </span>
    </Link>
  );
}
