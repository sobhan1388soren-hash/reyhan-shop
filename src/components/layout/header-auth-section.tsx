"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { logout } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/dal";
import { userDisplayName } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";

export function HeaderAuthSection({ user }: { user: CurrentUser | null }) {
  const { openModal } = useAuthModal();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = React.useCallback(async () => {
    setMenuOpen(false);
    await logout();
    router.refresh();
  }, [router]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openModal("login")}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/60 bg-white/80 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-300 hover:bg-white hover:shadow-md"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 20c.8-3.2 3.6-5 7-5s6.2 1.8 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">ورود / ثبت‌نام</span>
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/60 bg-white/80 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-300 hover:bg-white hover:shadow-md"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 20c.8-3.2 3.6-5 7-5s6.2 1.8 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="hidden max-w-[120px] truncate md:inline">{userDisplayName(user)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={cn("size-3.5 transition-transform duration-200", menuOpen && "rotate-180")}
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="منوی حساب کاربری"
          className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/60 bg-white/90 py-1.5 shadow-[0_16px_48px_-12px_rgba(4,46,58,0.25)] backdrop-blur-2xl"
        >
          <div className="border-b border-border/50 px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">{userDisplayName(user)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{user.phone}</p>
          </div>
          <Link
            href="/account/orders"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-muted-foreground" fill="none">
              <path d="M2.5 5.5L8 2.5l5.5 3v5L8 13.5l-5.5-3v-5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M2.5 5.5L8 8.5l5.5-3M8 8.5v5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            سفارش‌های من
          </Link>
          <Link
            href="/account/profile"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-muted-foreground" fill="none">
              <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2.5 13.5c.5-2.5 2.8-4 5.5-4s5 1.5 5.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            تنظیمات حساب
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/5"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M6 2.5H3.5v11H6M10 5.5L13 8l-3 2.5M13 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            خروج از حساب
          </button>
        </div>
      )}
    </div>
  );
}
