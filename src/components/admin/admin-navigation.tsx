"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AdminIcon } from "@/components/admin/admin-icons";
import type { AdminNavSection } from "@/lib/admin/rules";

// AdminNavigation — role-filtered nav sections (pre-filtered server-side
// by filterAdminNavForRole; this component never decides authorization).

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminNavigation({
  sections,
  onNavigate,
  orientation = "vertical",
}: {
  sections: AdminNavSection[];
  onNavigate?: () => void;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  if (sections.length === 0) return null;

  if (orientation === "horizontal") {
    const items = sections.flatMap((s) => s.items);
    return (
      <nav aria-label="ناوبری مدیریت" className="overflow-x-auto">
        <ul className="flex items-center gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            if (item.disabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    title="به‌زودی"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60"
                    )}
                  >
                    <AdminIcon name={item.icon} />
                    {item.label}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <AdminIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="ناوبری مدیریت">
      <ul className="space-y-4">
        {sections.map((section, i) => (
          <li key={section.label ?? `section-${i}`}>
            {section.label && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                if (item.disabled) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title="این بخش به‌زودی فعال می‌شود"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
                      >
                        <AdminIcon name={item.icon} />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full border border-border px-1.5 text-[10px] leading-4 text-muted-foreground">
                          به‌زودی
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <AdminIcon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
