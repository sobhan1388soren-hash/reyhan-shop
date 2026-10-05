import * as React from "react";
import { cn } from "@/lib/utils";

// Reyhan Button — medical trust, water precision
// Variants map to Reyhan tokens; supports future RTL via logical spacing

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  // Primary: Reyhan Blue — trust, main action
  // Phase 2 — ultra-luxury CTA: shimmer sweep + glowing ocean shadow lift on hover
  default:
    "bg-primary text-primary-foreground hover:bg-[var(--reyhan-blue-700)] active:bg-[var(--reyhan-blue-800)] shadow-sm hover:-translate-y-px hover:shadow-[0_8px_24px_-6px_rgb(14_165_200/0.65)] active:translate-y-0 after:pointer-events-none after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-l after:from-transparent after:via-white/40 after:to-transparent after:transition-transform after:duration-700 hover:after:translate-x-full",
  // Secondary: muted slate — secondary actions
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-slate-200",
  // Outline: clean medical border
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  // Ghost: minimal, for tertiary
  ghost: "hover:bg-accent hover:text-accent-foreground",
  // Destructive: health warning
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          // base — accessible: 44px min touch is met by default/lg; sm/icon for dense UI
          // Phase 2 — relative + overflow-hidden hosts the CTA shimmer sweep;
          // shadow/transform join the transition for the glowing lift.
          "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md text-sm font-medium",
          "ring-offset-background transition-[color,background-color,box-shadow,transform] duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
