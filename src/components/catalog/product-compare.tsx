"use client";

import { useCompare } from "@/lib/compare/hooks";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CompareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

export function CompareButton({ slug }: { slug: string }) {
  const { add, remove, checkInCompare } = useCompare();
  const inCompare = checkInCompare(slug);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = add(slug);
    if (!result.ok && result.error) {
      alert(result.error);
    }
  }

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    remove(slug);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={inCompare ? handleRemove : handleAdd}
      aria-label={inCompare ? "حذف از مقایسه" : "افزودن به مقایسه"}
    >
      <GridIcon />
      {inCompare ? "حذف از مقایسه" : "مقایسه"}
    </Button>
  );
}

export function CompareBar() {
  const { slugs, clear } = useCompare();

  if (slugs.length === 0) return null;

  return (
    <div className="fixed bottom-0 start-0 end-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {slugs.length} محصول در مقایسه
          </Badge>
          <Link
            href="/compare"
            className="text-sm font-medium text-primary hover:underline"
          >
            مقایسه کن
          </Link>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground"
        >
          پاک کردن
        </Button>
      </div>
    </div>
  );
}

export function CompareNavBadge() {
  const { slugs } = useCompare();

  if (slugs.length === 0) return null;

  return (
    <Link href="/compare" className="relative">
      <GridIcon />
      <span className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
        {slugs.length}
      </span>
    </Link>
  );
}