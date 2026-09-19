import * as React from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "sm" | "lg" | "full";
}

const sizeClasses = {
  default: "max-w-7xl", // 1280px — professional e-commerce
  sm: "max-w-3xl",
  lg: "max-w-[1400px]",
  full: "max-w-full",
} as const;

// Reyhan Container — responsive, RTL-aware (uses logical margin inline)
// Provides consistent horizontal rhythm for medical-clean layout
export function Container({
  className,
  size = "default",
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

// Optional stack primitives — not business features
export function Section({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-8 sm:py-12", className)} {...props} />
  );
}
