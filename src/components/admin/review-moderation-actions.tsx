"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  moderateReviewAction,
  type ReviewModerationActionState,
} from "@/app/actions/review-moderation";
import { AdminFormFeedback } from "@/components/admin/admin-form";
import type { ReviewStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

// ReviewModerationActions — approve / reject / return-to-pending. The
// moderation flow and authorization are server-side (existing reviews
// service); reject requires a confirmation step.

export function ReviewModerationActions({
  reviewId,
  status,
}: {
  reviewId: string;
  status: ReviewStatus;
}) {
  const [state, action, pending] = useActionState<ReviewModerationActionState, FormData>(
    moderateReviewAction,
    {}
  );
  const [armed, setArmed] = React.useState(false);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <div className="flex flex-wrap items-center gap-2">
        {status !== "APPROVED" && (
          <button
            type="submit"
            name="status"
            value="APPROVED"
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md bg-[var(--reyhan-green-600)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--reyhan-green-700)] disabled:opacity-50"
          >
            {pending ? "..." : "تأیید و انتشار"}
          </button>
        )}

        {status !== "REJECTED" &&
          (armed ? (
            <>
              <span className="text-[11px] text-muted-foreground">رد قطعی باشد؟</span>
              <button
                type="submit"
                name="status"
                value="REJECTED"
                disabled={pending}
                className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                تأیید رد
              </button>
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                انصراف
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border border-destructive/30 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              )}
            >
              رد کردن
            </button>
          ))}

        {status !== "PENDING" && (
          <button
            type="submit"
            name="status"
            value="PENDING"
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            بازگرداندن به بررسی
          </button>
        )}
      </div>
      <AdminFormFeedback message={state.message} error={state.error} />
    </form>
  );
}