"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type LoadingSpinnerSize = "sm" | "md" | "lg";

type LoadingSpinnerProps = {
  size?: LoadingSpinnerSize;
  label?: string;
  className?: string;
  /** When true, renders only the spinner without the status label wrapper. */
  inline?: boolean;
};

const sizeClasses: Record<LoadingSpinnerSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

const strokeWidth: Record<LoadingSpinnerSize, string> = {
  sm: "3",
  md: "3.5",
  lg: "4",
};

export function LoadingSpinner({
  size = "md",
  label,
  className,
  inline = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn(sizeClasses[size], "animate-spin-reyhan text-primary")}
      fill="none"
      role="img"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={strokeWidth[size]}
        strokeOpacity="0.15"
        strokeLinecap="round"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth={strokeWidth[size]}
        strokeLinecap="round"
        strokeOpacity="0.9"
        className="animate-spin-reyhan-arc"
      />
    </svg>
  );

  if (inline) {
    return <span className={cn("inline-flex items-center", className)}>{spinner}</span>;
  }

  return (
    <div
      role="status"
      aria-label={label ?? "در حال بارگذاری"}
      className={cn(
        "flex flex-col items-center gap-2",
        className
      )}
    >
      {spinner}
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

export function InlineSpinner({ size = "sm", className }: { size?: LoadingSpinnerSize; className?: string }) {
  return (
    <LoadingSpinner size={size} inline className={cn("shrink-0", className)} />
  );
}