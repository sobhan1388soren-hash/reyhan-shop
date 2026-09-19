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
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/50">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 text-muted-foreground"
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
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      {actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
