"use client";

import { useActionState } from "react";
import { setDiscountActiveAction, type DiscountActionState } from "@/app/actions/discounts";
import { AdminFormFeedback } from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";

// DiscountStatusToggle — activate/deactivate via the existing discount
// service. Authorization/validation are server-side.

export function DiscountStatusToggle({
  discountId,
  isActive,
}: {
  discountId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState<DiscountActionState, FormData>(
    setDiscountActiveAction,
    {}
  );
  const next = !isActive;

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="discountId" value={discountId} />
      <input type="hidden" name="isActive" value={next ? "true" : "false"} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50",
          !next && "text-[var(--reyhan-green-700)]"
        )}
      >
        {pending ? "..." : next ? "فعال کردن" : "غیرفعال کردن"}
      </button>
      <AdminFormFeedback message={state.message} error={state.error} />
    </form>
  );
}