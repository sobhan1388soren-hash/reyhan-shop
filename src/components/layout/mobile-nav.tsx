"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavigation } from "@/lib/navigation";

// Mobile navigation — sheet drawer, accessible, RTL-aware (start/end)
// No external deps; focus management and body lock handled manually

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const [productsOpen, setProductsOpen] = React.useState(true);
  const pathname = usePathname();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const wasOpenRef = React.useRef(false);

  // Note: drawer also closes via Link onClick handlers below; no pathname effect needed
  // pathname is still used for active state highlighting

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Move focus into the dialog on open and return it to the trigger on
  // close, so keyboard and screen-reader users are not left behind.
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      // preventScroll: the drawer is fixed and body scroll is locked —
      // don't yank the page behind it on touch devices.
      closeRef.current?.focus({ preventScroll: true });
    } else if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Trigger — visible below lg */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "بستن منو" : "باز کردن منو"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent lg:hidden"
      >
        {/* Hamburger / Close — no icon lib, inline SVG for build stability */}
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

      {/* Overlay + Drawer */}
      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "visible" : "invisible"
        )}
      >
        {/* Backdrop */}
        <button
          aria-label="بستن منو"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          tabIndex={open ? 0 : -1}
        />

        {/* Panel — slide from start (supports RTL via logical start) */}
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="ناوبری موبایل"
          className={cn(
            "absolute inset-y-0 start-0 flex w-[86%] max-w-[360px] flex-col bg-background shadow-xl transition-transform duration-200",
            "border-e",
            open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
          )}
        >
          {/* Panel header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
              aria-label="ریحان — صفحه اصلی"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                >
                  <path
                    d="M7 16C7 16 9 14 10.5 12C12 10 13.5 8 15 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 18C12 18 12.5 14.5 14 12C15.5 9.5 18 7 18 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <circle cx="7" cy="16.5" r="1.4" fill="currentColor" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                ریحان
              </span>
            </Link>
            <button
              ref={closeRef}
              type="button"
              aria-label="بستن منو"
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

          {/* Scrollable nav */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav aria-label="ناوبری موبایل">
              <ul className="space-y-1">
                {mainNavigation.map((section) => {
                  const hasChildren = !!section.items?.length;
                  const active = isActive(section.href);

                  if (!hasChildren) {
                    return (
                      <li key={section.label}>
                        <Link
                          href={section.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                            active
                              ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          {section.label}
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={section.label}>
                      <div
                        className={cn(
                          "rounded-lg",
                          isActive(section.href) && "bg-muted/60"
                        )}
                      >
                        <div className="flex items-center">
                          <Link
                            href={section.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex flex-1 items-center rounded-lg px-3 py-3 text-sm font-medium",
                              active
                                ? "text-[var(--reyhan-blue-700)]"
                                : "text-foreground"
                            )}
                          >
                            {section.label}
                          </Link>
                          <button
                            type="button"
                            aria-expanded={productsOpen}
                            aria-controls="mobile-products"
                            onClick={() => setProductsOpen((v) => !v)}
                            className="me-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                            aria-label={productsOpen ? "بستن دسته‌بندی محصولات" : "باز کردن دسته‌بندی محصولات"}
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 16 16"
                              className={cn(
                                "size-4 transition-transform",
                                productsOpen && "rotate-180"
                              )}
                              fill="none"
                            >
                              <path
                                d="M4 6L8 10L12 6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>

                        <ul
                          id="mobile-products"
                          className={cn(
                            "mx-2 mb-2 space-y-1 overflow-hidden rounded-lg border bg-card px-2 py-2 transition-all",
                            productsOpen ? "block" : "hidden"
                          )}
                        >
                          {section.items?.map((item) => {
                            const itemActive = pathname === item.href;
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    "flex flex-col rounded-md px-3 py-2.5",
                                    itemActive
                                      ? "bg-[var(--reyhan-blue-50)]"
                                      : "hover:bg-muted"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      itemActive
                                        ? "text-[var(--reyhan-blue-700)]"
                                        : "text-foreground"
                                    )}
                                  >
                                    {item.label}
                                  </span>
                                  {item.description && (
                                    <span className="mt-0.5 text-xs text-muted-foreground">
                                      {item.description}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Trust row — medical clean */}
            <div className="mt-6 rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-600)]">
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
                    <path
                      d="M4 8L7 11L12 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                تخصص تصفیه آب
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                متخصص تصفیه آب خانگی. طراحی تمیز، پشتیبانی قابل اعتماد.
              </p>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[var(--reyhan-blue-700)]"
              >
                تماس با ما
              </Link>
            </div>
          </div>

          {/* Panel footer — contact */}
          <div className="border-t px-5 py-4">
            <p className="text-xs text-muted-foreground">
              ریحان — تصفیه آب خانگی
              <br />
              <span className="text-[11px] tracking-wide opacity-70">
                اعتماد · سلامت · تخصص
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
