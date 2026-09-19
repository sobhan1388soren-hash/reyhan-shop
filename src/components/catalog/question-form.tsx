"use client";

// Product question submission form — any authenticated user may ask;
// the question is created PENDING and only appears on the product page
// after a staff answer (status ANSWERED).

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { askProductQuestionAction } from "@/app/actions/reviews";
import { initialQuestionFormState } from "@/lib/reviews/form-state";
import { cn } from "@/lib/utils";

export function QuestionForm({
  productId,
  productSlug,
  isAuthenticated,
}: {
  productId: string;
  productSlug: string;
  isAuthenticated: boolean;
}) {
  const [state, action, pending] = useActionState(
    askProductQuestionAction,
    initialQuestionFormState
  );

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm leading-7 text-muted-foreground">
        برای پرسیدن سؤال درباره این محصول،{" "}
        <Link
          href={`/login?next=/products/${productSlug}`}
          className="font-medium text-[var(--reyhan-blue-700)] hover:underline"
        >
          وارد حساب کاربری
        </Link>{" "}
        شوید.
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

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-card p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />

      <div>
        <label
          htmlFor="question-input"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          پرسش شما درباره این محصول
        </label>
        <textarea
          id="question-input"
          name="question"
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="مثلاً: این دستگاه برای آب شهری شهرستان مناسب است؟"
        />
        {state.fieldErrors?.question && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.question}</p>
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
        {pending ? "در حال ارسال…" : "ارسال پرسش"}
      </button>
    </form>
  );
}
