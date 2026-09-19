"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateOrderStatusAction, type OrderActionState } from "@/app/actions/orders";
import {
  allowedOrderTransitions,
  requiresOrderConfirmation,
  cancellationPaymentNotice,
  ORDER_FULFILLMENT_STEPS,
} from "@/lib/admin/order-admin-rules";
import { orderStatusLabels } from "@/lib/auth/labels";
import { AdminFormFeedback } from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

// OrderStatusPanel — professional stepper + guarded transition actions.
// The transition table is the single source of truth (order-admin-rules);
// invalid transitions are never rendered as available actions.

const TERMINAL_VISUALS: Record<string, { label: string; className: string }> = {
  CANCELLED: {
    label: "این سفارش لغو شده است.",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  RETURNED: {
    label: "این سفارش مرجوع شده است.",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  },
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_FULFILLMENT_STEPS.indexOf(status);
  const terminal = currentIndex === -1;

  return (
    <ol className="flex flex-wrap items-stretch gap-0" aria-label="چرخه وضعیت سفارش">
      {ORDER_FULFILLMENT_STEPS.map((step, index) => {
        const completed = !terminal && index < currentIndex;
        const current = !terminal && index === currentIndex;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  completed && "border-transparent bg-[var(--reyhan-green-600)] text-white",
                  current && "border-primary bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)] ring-2 ring-primary/30",
                  !completed && !current && "border-border bg-muted text-muted-foreground"
                )}
                aria-current={current ? "step" : undefined}
              >
                {completed ? <CheckIcon /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-4",
                  current ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {orderStatusLabels[step]}
              </span>
            </div>
            {index < ORDER_FULFILLMENT_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-0.5 mb-5 hidden h-0.5 flex-1 rounded-full sm:block",
                  completed ? "bg-[var(--reyhan-green-300)]" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderStatusPanel({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const [state, action, pending] = useActionState<OrderActionState, FormData>(
    updateOrderStatusAction,
    {}
  );
  const [armedTerminal, setArmedTerminal] = React.useState<OrderStatus | null>(null);

  const terminal = (["CANCELLED", "RETURNED"] as OrderStatus[]).includes(status);
  const targets = allowedOrderTransitions(status);
  const forwardTargets = targets.filter((t) => !requiresOrderConfirmation(t));
  const terminalTargets = targets.filter((t) => requiresOrderConfirmation(t));
  const paidNotice = cancellationPaymentNotice(paymentStatus);

  return (
    <div className="space-y-5">
      {terminal ? (
        <div
          className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", TERMINAL_VISUALS[status]?.className)}
          role="status"
        >
          {TERMINAL_VISUALS[status]?.label}
        </div>
      ) : (
        <OrderTimeline status={status} />
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />

        {forwardTargets.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">انتقال به مرحله بعد</p>
            <div className="flex flex-wrap gap-2">
              {forwardTargets.map((target) => (
                <button
                  key={target}
                  type="submit"
                  name="status"
                  value={target}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:opacity-50"
                >
                  {pending ? "..." : orderStatusLabels[target]}
                </button>
              ))}
            </div>
          </div>
        )}

        {terminalTargets.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="mb-2 text-xs font-medium text-destructive">عملیات حساس</p>
            <div className="flex flex-wrap items-center gap-2">
              {armedTerminal === null ? (
                terminalTargets.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => setArmedTerminal(target)}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md border bg-background px-4 text-xs font-medium transition-colors",
                      target === "CANCELLED"
                        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border-input text-foreground hover:bg-accent"
                    )}
                  >
                    {target === "CANCELLED" ? "لغو سفارش" : orderStatusLabels[target]}
                  </button>
                ))
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {armedTerminal === "CANCELLED" ? "لغو سفارش قطعی است؟" : "ثبت مرجوعی قطعی است؟"}
                  </span>
                  <button
                    type="submit"
                    name="status"
                    value={armedTerminal}
                    disabled={pending}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md px-4 text-xs font-semibold text-white transition-colors disabled:opacity-50",
                      armedTerminal === "CANCELLED"
                        ? "bg-destructive hover:bg-red-600"
                        : "bg-amber-600 hover:bg-amber-700"
                    )}
                  >
                    {pending ? "..." : "تأیید"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setArmedTerminal(null)}
                    className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    انصراف
                  </button>
                </>
              )}
            </div>

            {armedTerminal === "CANCELLED" && paidNotice && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700" role="note">
                {paidNotice}
              </p>
            )}
          </div>
        )}

        {targets.length === 0 && (
          <p className="text-xs text-muted-foreground">برای این وضعیت، انتقال مجاز دیگری وجود ندارد.</p>
        )}

        <AdminFormFeedback message={state.message} error={state.error} />
      </form>
    </div>
  );
}