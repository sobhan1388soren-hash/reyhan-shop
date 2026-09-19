"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AdminNavSection } from "@/lib/admin/rules";
import { AdminNavigation } from "@/components/admin/admin-navigation";

// AdminMobileNav — top-bar nav trigger + slide-in drawer (below lg).
// Mirrors the public MobileNav interaction model; RTL-aware (start/end).

export function AdminMobileNav({ sections }: { sections: AdminNavSection[] }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "بستن منوی مدیریت" : "باز کردن منوی مدیریت"}
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent lg:hidden"
      >
        <span className="relative block size-4">
          <span
            className={cn(
              "absolute inset-x-0 top-0 h-0.5 bg-current transition-all",
              open && "top-[7px] rotate-45"
            )}
          />
          <span
            className={cn(
              "absolute inset-x-0 top-[7px] h-0.5 bg-current transition-opacity",
              open && "opacity-0"
            )}
          />
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 h-0.5 bg-current transition-all",
              open && "bottom-[7px] -rotate-45"
            )}
          />
        </span>
      </button>

      <div
        aria-hidden={!open}
        className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")}
      >
        <button
          aria-label="بستن منوی مدیریت"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          tabIndex={open ? 0 : -1}
        />

        <div
          id="admin-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="ناوبری مدیریت"
          className={cn(
            "absolute inset-y-0 start-0 flex w-[86%] max-w-[320px] flex-col border-e bg-background shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <p className="text-sm font-semibold text-foreground">پنل مدیریت ریحان</p>
            <button
              type="button"
              aria-label="بستن منوی مدیریت"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <AdminNavigation sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
