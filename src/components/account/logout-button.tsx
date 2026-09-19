import { logout } from "@/app/actions/auth";

// Logout button — form POST to a server action so it can't be triggered by CSRF GET.
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 shrink-0" fill="none">
          <path d="M14 4.5H7a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 7 19.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13 12h7m0 0-2.8-2.8M20 12l-2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        خروج از حساب
      </button>
    </form>
  );
}
