"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavigation } from "@/lib/navigation";

// Desktop navigation — clean, medical, trust-forward
// Hover dropdown for Products; prepared for future RTL (logical gaps)
export function MainNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 lg:flex">
      {mainNavigation.map((section) => {
        const active = isActive(section.href);
        const hasChildren = !!section.items?.length;

        if (!hasChildren) {
          return (
            <Link
              key={section.label}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-muted hover:text-foreground",
                // RTL-safe sliding underline: scale-x is direction-agnostic,
                // insets ride on logical start/end properties.
                "after:absolute after:bottom-1 after:start-3 after:end-3 after:h-0.5 after:origin-center after:rounded-full after:bg-gradient-to-l after:from-[#22d3ee] after:to-[#00f5a0] after:transition-transform after:duration-300",
                active
                  ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)] after:scale-x-100"
                  : "text-muted-foreground after:scale-x-0 hover:after:scale-x-100"
              )}
            >
              {section.label}
            </Link>
          );
        }

        // Products with dropdown
        return (
          <div key={section.label} className="group relative">
            <Link
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-muted hover:text-foreground",
                // RTL-safe sliding underline (see simple links above).
                "after:absolute after:bottom-1 after:start-3 after:end-3 after:h-0.5 after:origin-center after:rounded-full after:bg-gradient-to-l after:from-[#22d3ee] after:to-[#00f5a0] after:transition-transform after:duration-300",
                active
                  ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)] after:scale-x-100"
                  : "text-muted-foreground after:scale-x-0 hover:after:scale-x-100"
              )}
            >
              {section.label}
              <svg
                aria-hidden="true"
                className="size-3.5 opacity-60 transition-transform group-hover:rotate-180"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            {/* Dropdown — medical clean, subtle shadow, Blue accent top border */}
            <div className="invisible absolute start-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="min-w-[320px] overflow-hidden rounded-xl border bg-popover p-2 shadow-lg">
                <div className="border-b bg-muted/50 px-3 py-2 -m-2 mb-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                    خرید بر اساس دسته‌بندی
                  </p>
                </div>
                <ul className="space-y-1">
                  {section.items?.map((item) => {
                    const itemActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex flex-col rounded-lg px-3 py-2.5 transition-colors",
                            "hover:bg-muted",
                            itemActive && "bg-[var(--reyhan-blue-50)]"
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-medium leading-none",
                              itemActive
                              ? "text-[var(--reyhan-blue-700)]"
                              : "text-foreground"
                            )}
                          >
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="mt-1 text-xs leading-4 text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 border-t pt-2">
                  <Link
                    href={section.href}
                    className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
                  >
                    مشاهده همه محصولات
                    <svg
                      aria-hidden="true"
                      className="size-3.5 rtl:rotate-180"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
