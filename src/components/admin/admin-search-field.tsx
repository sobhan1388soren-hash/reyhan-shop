"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/input";

// AdminSearchField — URL-state search for admin lists (server components
// only read the query; no other client state). Preserves the other active
// filters and resets pagination, mirroring the storefront SearchBar model.

export function AdminSearchField({
  name = "q",
  placeholder = "جستجو…",
  label,
  initValue = "",
}: {
  name?: string;
  placeholder?: string;
  label: string;
  initValue?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(initValue);

  const submit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set(name, trimmed);
      else params.delete(name);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams, value, name]
  );

  return (
    <form onSubmit={submit} className="relative w-full sm:max-w-xs" role="search">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
      >
        <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.2 10.2L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <Input
        type="search"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="ps-10"
        aria-label={label}
      />
    </form>
  );
}
