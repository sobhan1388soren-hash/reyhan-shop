"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { FilterOption, AvailabilityState } from "@/lib/catalog/types";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

interface FilterSidebarProps {
  filterOptions: FilterOption[];
  basePath?: string;
  searchParams?: SearchParamsRecord;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildUrl(basePath: string, params: SearchParamsRecord): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== "") url.append(key, String(v));
      }
    } else {
      url.set(key, String(value));
    }
  }
  const qs = url.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function FilterSidebar({
  filterOptions,
  basePath = "/products",
  searchParams = {},
}: FilterSidebarProps) {
  const router = useRouter();
  const liveParams = useSearchParams();

  const availabilityOptions: { value: AvailabilityState; label: string }[] = [
    { value: "in_stock", label: "موجود در انبار" },
    { value: "low_stock", label: "موجودی محدود" },
  ];

  const liveAvailability = liveParams.getAll("availability");
  const propAvailability = toArray(searchParams.availability);
  const selectedAvailability = liveAvailability.length > 0 ? liveAvailability : propAvailability;

  const toggleAvailability = React.useCallback(
    (val: AvailabilityState) => {
      const current = new URLSearchParams(liveParams.toString());
      const existing = current.getAll("availability");
      current.delete("availability");
      const next = existing.includes(val)
        ? existing.filter((v) => v !== val)
        : [...existing, val];
      for (const v of next) current.append("availability", v);
      current.delete("page");
      const qs = current.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [basePath, liveParams, router]
  );

  const liveMin = liveParams.get("minPrice") ?? "";
  const liveMax = liveParams.get("maxPrice") ?? "";
  const [localMin, setLocalMin] = React.useState<string>(
    typeof searchParams.minPrice === "string" ? searchParams.minPrice : liveMin
  );
  const [localMax, setLocalMax] = React.useState<string>(
    typeof searchParams.maxPrice === "string" ? searchParams.maxPrice : liveMax
  );

  const priceTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (priceTimeout.current) clearTimeout(priceTimeout.current);
    };
  }, []);

  const schedulePricePush = React.useCallback(
    (min: string, max: string) => {
      if (priceTimeout.current) clearTimeout(priceTimeout.current);
      priceTimeout.current = setTimeout(() => {
        const current = new URLSearchParams(liveParams.toString());
        if (min) current.set("minPrice", min);
        else current.delete("minPrice");
        if (max) current.set("maxPrice", max);
        else current.delete("maxPrice");
        current.delete("page");
        const qs = current.toString();
        router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      }, 500);
    },
    [basePath, liveParams, router]
  );

  const selectedSpecs = React.useMemo(() => {
    const out: Record<string, string[]> = {};
    const entries = liveParams.toString()
      ? Array.from(liveParams.entries())
      : Object.entries(searchParams).flatMap(([k, v]) => {
          if (v == null) return [];
          return Array.isArray(v) ? v.map((val) => [k, val] as [string, string]) : [[k, v as string] as [string, string]];
        });
    for (const [key, val] of entries) {
      if (key.startsWith("spec_")) {
        const specKey = key.slice(5);
        out[specKey] = out[specKey] ?? [];
        out[specKey].push(val);
      }
    }
    return out;
  }, [liveParams, searchParams]);

  const toggleSpec = React.useCallback(
    (key: string, value: string) => {
      const current = new URLSearchParams(liveParams.toString());
      const paramKey = `spec_${key}`;
      const existing = current.getAll(paramKey);
      current.delete(paramKey);
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      for (const v of next) current.append(paramKey, v);
      current.delete("page");
      const qs = current.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [basePath, liveParams, router]
  );

  const clearAll = React.useCallback(() => {
    const current = new URLSearchParams(liveParams.toString());
    current.delete("minPrice");
    current.delete("maxPrice");
    current.delete("availability");
    current.delete("inStock");
    current.delete("page");
    for (const key of Array.from(current.keys())) {
      if (key.startsWith("spec_")) current.delete(key);
    }
    const qs = current.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }, [basePath, liveParams, router]);

  void buildUrl;

  return (
    <aside className={cn("space-y-6")}>
      {/* Availability */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">موجودی</h3>
        <div className="space-y-2">
          {availabilityOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
            >
              <input
                type="checkbox"
                checked={selectedAvailability.includes(opt.value)}
                onChange={() => toggleAvailability(opt.value)}
                className="size-4 rounded border-input"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">محدوده قیمت (تومان)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={localMin}
            onChange={(e) => {
              const val = e.target.value;
              setLocalMin(val);
              schedulePricePush(val, localMax);
            }}
            placeholder="از"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            aria-label="حداقل قیمت"
            min={0}
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            value={localMax}
            onChange={(e) => {
              const val = e.target.value;
              setLocalMax(val);
              schedulePricePush(localMin, val);
            }}
            placeholder="تا"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            aria-label="حداکثر قیمت"
            min={0}
          />
        </div>
      </div>

      {/* Specification filters - dynamic from product data */}
      {filterOptions.map((fo) => (
        <div key={fo.key}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{fo.label}</h3>
          <div className="space-y-2">
            {fo.values.map((opt) => {
              const checked = selectedSpecs[fo.key]?.includes(opt.value) ?? false;
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSpec(fo.key, opt.value)}
                    className="size-4 rounded border-input"
                  />
                  {opt.label}
                  {opt.count != null && (
                    <span className="ms-auto text-xs text-muted-foreground/60">{opt.count}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Clear all */}
      <button
        type="button"
        onClick={clearAll}
        className="w-full rounded-md border border-input bg-background py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        حذف همه فیلترها
      </button>
    </aside>
  );
}
