"use client";

// Header cart indicator — live item count synced with the guest cart store.
// Renders on the client; count is read from the same useSyncExternalStore
// the rest of the app uses, so it updates instantly on every cart change.
// The server snapshot is empty (SSR renders no badge; no hydration mismatch).

import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { toFaDigits } from "@/lib/catalog/format";

export function HeaderCartLink() {
  const { count } = useCart();
  const hasCount = count > 0;

  return (
    <Link
      href="/cart"
      aria-label={
        hasCount ? `سبد خرید — ${toFaDigits(count)} قلم کالا` : "سبد خرید"
      }
      className="relative inline-flex size-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
        <path
          d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="17.5" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {hasCount && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -start-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground"
        >
          {toFaDigits(count)}
        </span>
      )}
    </Link>
  );
}
