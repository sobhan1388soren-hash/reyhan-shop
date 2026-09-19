import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/lib/catalog/types";
import { formatNumber, toFaDigits } from "@/lib/catalog/format";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";

// Shared admin list foundation — server-rendered only (no client data
// table). Every admin module composes: Toolbar → (Table | Mobile cards)
// → Footer (count + pagination). Empty/error states are explicit; lists
// never fake data.

export function AdminListToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b bg-muted/20 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{search}</div>
      <div className="flex flex-wrap items-center gap-2">
        {filters}
        {actions}
      </div>
    </div>
  );
}

export type AdminColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Extra classes for the th and matching td (alignment/width hints). */
  className?: string;
  /** Hide this column below `lg` to avoid clutter on narrower screens. */
  secondary?: boolean;
};

export function AdminTable<T>({
  caption,
  columns,
  rows,
  keyOf,
}: {
  caption: string;
  columns: AdminColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-start font-medium whitespace-nowrap",
                  col.secondary && "hidden xl:table-cell",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={keyOf(row)}
              className={cn(
                "border-b last:border-b-0 transition-colors hover:bg-accent/40",
                i % 2 === 1 && "bg-muted/10"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    col.secondary && "hidden xl:table-cell",
                    col.className
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * AdminRowActions — compact row action group. Primary action remains a
 * visible link; secondary actions belong to the detail page in read-only
 * modules (Phase 14-A has no mutation menus — none exist yet).
 */
export function AdminRowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

/**
 * Mobile/tablet presentation: deliberate card list (never a squeezed
 * desktop table). Each module renders its own card content so primary
 * info and actions survive while secondary info is dropped.
 */
export function AdminCardList<T>({
  rows,
  keyOf,
  renderCard,
  label,
}: {
  rows: T[];
  keyOf: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  label: string;
}) {
  return (
    <ul aria-label={label} className="divide-y lg:hidden">
      {rows.map((row) => (
        <li key={keyOf(row)}>{renderCard(row)}</li>
      ))}
    </ul>
  );
}

export function AdminListFooter({
  meta,
  basePath,
  searchParams,
  itemLabel,
  children,
}: {
  meta: PaginationMeta;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  itemLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t bg-muted/20 p-4 sm:p-5">
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {formatNumber(meta.total)} {itemLabel}
          {meta.totalPages > 1 && (
            <>
              {" "}
              — صفحه {toFaDigits(meta.page)} از {toFaDigits(meta.totalPages)}
            </>
          )}
        </p>
        {meta.totalPages > 1 && (
          <nav aria-label="صفحه‌بندی">
            <div className="flex items-center gap-1">
              {meta.hasPrev && (
                <Link
                  href={buildListHref(basePath, searchParams, meta.page - 1)}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
                  aria-label="صفحه قبل"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
              {meta.hasNext && (
                <Link
                  href={buildListHref(basePath, searchParams, meta.page + 1)}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
                  aria-label="صفحه بعد"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

/** Preserve active filters while paging (page=1 drops the param). */
export function buildListHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, String(value));
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function AdminListErrorState({ onRetryHref = "/admin" }: { onRetryHref?: string }) {
  return (
    <AdminEmptyState
      title="خطا در دریافت اطلاعات"
      description="برقراری ارتباط با پایگاه داده ممکن نشد. لطفاً دوباره تلاش کنید."
      action={
        <Link
          href={onRetryHref}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          تلاش دوباره
        </Link>
      }
    />
  );
}

export { AdminEmptyState };
