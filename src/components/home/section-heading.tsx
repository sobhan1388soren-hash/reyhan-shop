import Link from "next/link";
import { cn } from "@/lib/utils";

// HomeSectionHeading — shared section header for the homepage. Keeps one
// consistent hierarchy: an optional small eyebrow, an h2 title, an optional
// supporting line, and an optional "view all" link on the inline end.
// RTL-aware via logical properties only.

export function HomeSectionHeading({
  eyebrow,
  title,
  description,
  viewAllHref,
  viewAllLabel,
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Optional id for the h2, to wire section aria-labelledby. */
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold text-[var(--reyhan-blue-600)]">{eyebrow}</p>
        )}
        <h2 id={id} className="mt-1.5 text-2xl font-extrabold text-[#042e3a] sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2.5 text-sm leading-7 text-muted-foreground">{description}</p>
        )}
      </div>
      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-input bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:self-auto"
        >
          {viewAllLabel}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 rtl:rotate-180" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  );
}
