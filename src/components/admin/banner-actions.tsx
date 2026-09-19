"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  setBannerActiveAction,
  deleteBannerAction,
  type BannerActionState,
} from "@/app/actions/banners";
import { AdminFormFeedback } from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";

// BannerActions — activate/deactivate + guarded two-step delete.
// Authorization and validation are server-side; this island only renders
// state and submits.

export function BannerActions({
  bannerId,
  isActive,
}: {
  bannerId: string;
  isActive: boolean;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState<BannerActionState, FormData>(
    setBannerActiveAction,
    {}
  );
  const next = !isActive;

  return (
    <div className="space-y-4">
      <form action={toggleAction} className="space-y-1">
        <input type="hidden" name="bannerId" value={bannerId} />
        <input type="hidden" name="isActive" value={next ? "true" : "false"} />
        <button
          type="submit"
          disabled={togglePending}
          className={cn(
            "inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50",
            !next && "text-[var(--reyhan-green-700)]"
          )}
        >
          {togglePending ? "..." : next ? "فعال کردن" : "غیرفعال کردن"}
        </button>
        <AdminFormFeedback message={toggleState.message} error={toggleState.error} />
      </form>

      <DeleteBannerForm bannerId={bannerId} />
    </div>
  );
}

function DeleteBannerForm({ bannerId }: { bannerId: string }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<BannerActionState, FormData>(
    deleteBannerAction,
    {}
  );

  if (state.message) {
    return <p className="text-xs text-[var(--reyhan-green-700)]" role="status">{state.message}</p>;
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className="inline-flex flex-wrap items-center gap-2 border-t pt-4"
    >
      <input type="hidden" name="bannerId" value={bannerId} />
      {armed ? (
        <>
          <span className="text-xs text-muted-foreground">حذف این بنر؟ این عمل بازگشت‌پذیر نیست.</span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-destructive px-4 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            تأیید حذف
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            انصراف
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex h-9 items-center rounded-md border border-destructive/30 px-4 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          حذف بنر
        </button>
      )}
      {state.error && <span className="text-[11px] text-destructive" role="alert">{state.error}</span>}
    </form>
  );
}
