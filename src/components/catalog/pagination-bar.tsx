import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/lib/catalog/types";
import { buildPageUrl } from "@/lib/catalog/pagination";
import { toFaDigits } from "@/lib/catalog/format";

export function PaginationBar({
  meta,
  basePath,
  searchParams,
}: {
  meta: PaginationMeta;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (meta.totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const { page, totalPages } = meta;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-1">
      {meta.hasPrev && (
        <Link
          href={buildPageUrl(basePath, searchParams, { page: page - 1 })}
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="صفحه قبل"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
            <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={p}
            href={buildPageUrl(basePath, searchParams, { page: p })}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium tabular-nums transition-colors",
              p === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
            aria-current={p === page ? "page" : undefined}
          >
            {toFaDigits(p)}
          </Link>
        )
      )}

      {meta.hasNext && (
        <Link
          href={buildPageUrl(basePath, searchParams, { page: page + 1 })}
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="صفحه بعد"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </nav>
  );
}