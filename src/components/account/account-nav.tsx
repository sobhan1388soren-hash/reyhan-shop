"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/account", label: "پیشخوان", icon: "home" },
  { href: "/account/profile", label: "اطلاعات شخصی", icon: "user" },
  { href: "/account/addresses", label: "نشانی‌ها", icon: "pin" },
  { href: "/account/orders", label: "سفارش‌ها", icon: "bag" },
  { href: "/account/invoices", label: "فاکتورها", icon: "doc" },
] as const;

function Icon({ name }: { name: (typeof items)[number]["icon"] }) {
  const cls = "size-4.5 shrink-0";
  switch (name) {
    case "home":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 20.5v-6h5v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "user":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 20c.8-3.2 3.6-5 7-5s6.2 1.8 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "pin":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M12 21s-6.5-5.4-6.5-10.3a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "bag":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M5.5 8h13l-1 12h-11l-1-12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "doc":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="ناوبری حساب کاربری" className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
      {items.map((item) => {
        const active =
          item.href === "/account"
            ? pathname === "/account"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
