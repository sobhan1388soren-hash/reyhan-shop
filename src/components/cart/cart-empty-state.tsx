"use client";

// Empty cart state — polished Persian empty-cart screen.
// Reuses the catalog EmptyState patterns (icon, message, CTAs) but with
// cart-specific illustration and links to products/categories.

import Link from "next/link";
import { productNavigation } from "@/lib/navigation";

export function CartEmptyState() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center shadow-card">
      {/* Illustration — empty cart */}
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--reyhan-blue-50)]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8 text-[var(--reyhan-blue-600)]" fill="none">
          <path
            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="17.5" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M12 11.5L12 8M12 11.5C12 11.5 9.6 11.4 9 10M12 11.5C12 11.5 14.4 11.4 15 10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>

      <h2 className="mt-5 text-lg font-bold text-foreground">سبد خرید شما خالی است</h2>
      <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
        هنوز کالایی به سبد خرید اضافه نکرده‌اید. از میان دستگاه‌ها، فیلترها و قطعات
        یدکی ریحان، کالاهای مورد نیازتان را انتخاب کنید.
      </p>

      <div className="mt-7 flex w-full flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
        <Link
          href="/products"
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] sm:w-auto"
        >
          مشاهده همه محصولات
        </Link>
        <Link
          href="/categories"
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
        >
          دسته‌بندی‌ها
        </Link>
      </div>

      {/* Quick category links */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t pt-6">
        {productNavigation.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
