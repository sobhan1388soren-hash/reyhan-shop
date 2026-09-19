import * as React from "react";
import { cn } from "@/lib/utils";

// Reyhan Badge — health/status signal; high contrast, Persian-ready

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "destructive";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  // Primary — Reyhan Blue
  default:
    "border-transparent bg-primary text-primary-foreground hover:bg-[var(--reyhan-blue-700)]",
  // Muted
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  // Outline — medical border
  outline: "text-foreground border-border",
  // Success — Reyhan Green health
  success:
    "border-transparent bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)] border border-[var(--reyhan-green-100)]",
  // Destructive
  destructive:
    "border-transparent bg-destructive text-destructive-foreground",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
