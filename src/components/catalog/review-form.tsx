"use client";

// Review submission form — star rating + title + comment. Client-side
// rendering only mirrors server rules for UX; every fact (purchase,
// validity) is re-verified server-side in the action.

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { submitProductReview } from "@/app/actions/reviews";
import { initialReviewFormState } from "@/lib/reviews/form-state";
import { toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  productSlug,
  canReview,
  isAuthenticated,
}: {
  productId: string;
  productSlug: string;
  /** Server-derived: user purchased the product and has no review yet. */
  canReview: boolean;
  isAuthenticated: boolean;
}) {
  const [state, action, pending] = useActionState(
    submitProductReview,
    initialReviewFormState
  );
  const [rating, setRating] = React.useState(0);
  const [hovered, setHovered] = React.useState(0);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm leading-7 text-muted-foreground">
        برای ثبت دیدگاه،{" "}
        <Link
          href={`/login?next=/products/${productSlug}`}
          className="font-medium text-[var(--reyhan-blue-700)] hover:underline"
        >
          وارد حساب کاربری
        </Link>{" "}
        شوید. ثبت دیدگاه تنها برای خریداران این محصول امکان‌پذیر است.
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm leading-7 text-muted-foreground">
        ثبت دیدگاه تنها برای خریداران این محصول فعال است. پس از خرید و تأیید
        پرداخت سفارش، می‌توانید تجربه خود را با سایر کاربران به اشتراک
        بگذارید.
      </div>
    );
  }

  if (state.status === "submitted") {
    return (
      <div
        role="status"
        className="rounded-xl border border-[var(--reyhan-green-500)]/40 bg-[var(--reyhan-green-50)] p-5 text-sm leading-7 text-[var(--reyhan-green-700)]"
      >
        {state.message}
      </div>
    );
  }

  const active = hovered || rating;

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="rating" value={rating || ""} />

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">امتیاز شما</p>
        <div className="flex items-center gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`${toFaDigits(i)} ستاره`}
              aria-pressed={rating === i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)}
              className="rounded-md p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                viewBox="0 0 20 20"
                className={cn(
                  "size-7 transition-colors",
                  i <= active ? "text-amber-400" : "text-muted-foreground/40"
                )}
                fill={i <= active ? "currentColor" : "none"}
              >
                <path
                  d="M10 1.7l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8L10 1.7Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.rating}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="review-title"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          عنوان دیدگاه (اختیاری)
        </label>
        <input
          id="review-title"
          name="title"
          type="text"
          maxLength={120}
          autoComplete="off"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {state.fieldErrors?.title && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.title}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="review-comment"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          متن دیدگاه
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="تجربه خود از این محصول را بنویسید…"
        />
        {state.fieldErrors?.comment && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.comment}</p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-xs leading-6 text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors",
          "hover:bg-[var(--reyhan-blue-700)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {pending ? "در حال ثبت…" : "ثبت دیدگاه"}
      </button>
    </form>
  );
}
