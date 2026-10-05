"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/input";

export function SearchBar({
  placeholder = "جستجوی محصولات…",
  basePath = "/products",
  initQuery = "",
}: {
  placeholder?: string;
  basePath?: string;
  initQuery?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(initQuery);

  const pushQuery = React.useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = query.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, searchParams, basePath]
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      pushQuery(value);
    },
    [value, pushQuery]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full rounded-xl border border-slate-200/60 bg-white/70 shadow-[0_2px_12px_-2px_rgb(12_107_138/0.12)] backdrop-blur-md transition-shadow focus-within:ring-2 focus-within:ring-emerald-400/70"
      role="search"
    >
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="border-transparent bg-transparent ps-10 focus-visible:ring-0 focus-visible:ring-offset-0"
        aria-label="جستجوی محصولات"
      />
    </form>
  );
}
