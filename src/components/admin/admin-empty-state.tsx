import * as React from "react";
import { cn } from "@/lib/utils";

// AdminEmptyState — honest empty state for modules that are not built yet.
// Never fakes data/metrics.

export function AdminEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)] [&_svg]:size-6">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
