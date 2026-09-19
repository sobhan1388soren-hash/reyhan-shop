"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

// AdminSelectFilter — GET-only select that writes a single query param
// (URL-state pattern shared with AdminSearchField). Empty value removes
// the param; pagination resets on every filter change. Options are
// pre-whitelisted server-side; unknown submitted values are dropped.

export function AdminSelectFilter({
  name,
  label,
  allLabel,
  options,
  value,
}: {
  name: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  value: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) params.set(name, e.target.value);
      else params.delete(name);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams, name]
  );

  return (
    <select
      value={value}
      onChange={handleChange}
      aria-label={label}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
