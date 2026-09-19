// Checkout progress indicator — cart → checkout (→ payment in Phase 10).
// Server component; purely visual, reflects the current phase position.

import { cn } from "@/lib/utils";

const steps = [
  { id: "cart", label: "سبد خرید", href: "/cart" },
  { id: "checkout", label: "تسویه حساب", href: null },
  { id: "payment", label: "پرداخت", href: null }, // activated in Phase 10
] as const;

export function CheckoutSteps({
  currentStep,
}: {
  currentStep: (typeof steps)[number]["id"];
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <ol
      aria-label="مراحل خرید"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-xs shadow-card sm:px-5"
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 font-medium",
                current
                  ? "text-[var(--reyhan-blue-700)]"
                  : done
                    ? "text-[var(--reyhan-green-600)]"
                    : "text-muted-foreground/70"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-[var(--reyhan-green-500)] bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]"
                      : "border-border bg-background text-muted-foreground/70"
                )}
              >
                {done ? (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  new Intl.NumberFormat("fa-IR").format(i + 1)
                )}
              </span>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="hidden h-px w-8 bg-border sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
