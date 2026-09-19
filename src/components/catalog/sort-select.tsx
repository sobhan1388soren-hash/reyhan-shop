"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { CatalogSortOption } from "@/lib/catalog/types";

export const SORT_OPTIONS: { value: CatalogSortOption; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "title_asc", label: "نام: الف تا ی" },
  { value: "title_desc", label: "نام: ی تا الف" },
];

export function SortSelect({
  basePath = "/products",
  currentSort = "newest",
}: {
  basePath?: string;
  currentSort?: CatalogSortOption | string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value as CatalogSortOption;
      const params = new URLSearchParams(searchParams.toString());
      if (val && val !== "newest") {
        params.set("sort", val);
      } else {
        params.delete("sort");
      }
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, searchParams, basePath]
  );

  return (
    <select
      value={currentSort}
      onChange={handleChange}
      aria-label="مرتب‌سازی محصولات"
      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
