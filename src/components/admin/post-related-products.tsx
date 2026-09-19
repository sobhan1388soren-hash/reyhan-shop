"use client";

import * as React from "react";
import type { PostProductOption } from "@/lib/blog/post-service";
import { toFaDigits } from "@/lib/catalog/format";

// PostRelatedProducts — manual, ordered selection of EXISTING catalog
// products for an article. The admin can search, add, reorder and remove;
// the selection is submitted as repeated `productId` fields, which the
// server action collects and re-verifies against real rows (forged ids
// never reach Prisma). No recommendation engine — links are editorial.

export type SelectedProduct = { id: string; title: string; slug: string };

export function PostRelatedProducts({
  selected,
  options,
  limit,
  error,
}: {
  /** Products already linked to the post (admin order). */
  selected: SelectedProduct[];
  /** All real products available for linking (server-provided). */
  options: PostProductOption[];
  /** POST_RELATED_PRODUCTS_MAX from the pure rules. */
  limit: number;
  error?: string;
}) {
  const [items, setItems] = React.useState<SelectedProduct[]>(selected);
  const [query, setQuery] = React.useState("");
  const [justAddedId, setJustAddedId] = React.useState<string | null>(null);

  const selectedIds = React.useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.title.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [options, query]);

  const add = (option: PostProductOption) => {
    if (selectedIds.has(option.id)) return;
    setItems((prev) => [...prev, { id: option.id, title: option.title, slug: option.slug }]);
    setJustAddedId(option.id);
    setQuery("");
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const move = (index: number, delta: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  React.useEffect(() => {
    if (justAddedId) {
      const timer = setTimeout(() => setJustAddedId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [justAddedId]);

  const atLimit = items.length >= limit;

  return (
    <div className="space-y-4">
      {/* Selected, ordered list */}
      {items.length > 0 ? (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cnRow(justAddedId === item.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {toFaDigits(index + 1)}
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`انتقال «${item.title}» به بالا`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 12V4M4.5 7.5 8 4l3.5 3.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`انتقال «${item.title}» به پایین`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 4v8M4.5 8.5 8 12l3.5-3.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`حذف «${item.title}» از محصولات مرتبط`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </span>
              {/* Submitted as a repeated field; order = display order. */}
              <input type="hidden" name="productId" value={item.id} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs leading-6 text-muted-foreground">
          هنوز محصولی به این مقاله متصل نشده است. محصولات زیر را جستجو و اضافه کنید.
        </p>
      )}

      {atLimit && (
        <p className="text-xs text-amber-700">
          به سقف {toFaDigits(limit)} محصول رسیده‌اید.
        </p>
      )}

      {/* Search + add */}
      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی محصول برای اتصال…"
          aria-label="جستجوی محصول برای اتصال"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={atLimit}
        />
        {!atLimit && filtered.length > 0 && (
          <ul className="max-h-48 overflow-auto rounded-md border bg-background">
            {filtered.slice(0, 30).map((option) => {
              const already = selectedIds.has(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => add(option)}
                    disabled={already}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate text-foreground">{option.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {already ? "افزوده شده" : "افزودن"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!atLimit && query && filtered.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            محصولی با این عبارت یافت نشد.
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function cnRow(justAdded: boolean): string {
  return [
    "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2",
    justAdded ? "border-[var(--reyhan-green-300)] bg-[var(--reyhan-green-50)]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
