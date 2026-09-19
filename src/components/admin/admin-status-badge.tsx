import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/admin/labels";

// AdminStatusBadge — one tone vocabulary for every admin module so a
// color always means the same thing (pending=paid=processing=cancelled…).
// Tones map onto the existing Reyhan design tokens.

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]",
  success: "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
};

export function AdminStatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
