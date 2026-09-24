import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

export function EmptyState({
  title = "نتیجه‌ای یافت نشد",
  description = "موردی با این مشخصات پیدا نشد.",
  actionHref = "/products",
  actionLabel = "مشاهده همه محصولات",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-14 text-center shadow-card", className)}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--reyhan-blue-50)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 text-[var(--reyhan-blue-600)]"
          fill="none"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M21 21l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-[15px] font-bold text-foreground sm:text-base">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
