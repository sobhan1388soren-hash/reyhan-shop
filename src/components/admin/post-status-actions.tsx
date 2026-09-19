"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  setPostStatusAction,
  deletePostAction,
  type PostActionState,
} from "@/app/actions/blog-posts";
import { postStatusLabels } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

// PostStatusActions — publish / archive / draft + guarded delete.
// Authorization and validation are server-side (the service re-checks the
// actor and refuses to publish empty content); this island only renders
// state and submits.

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

function StatusButton({
  postId,
  status,
  label,
  variant,
}: {
  postId: string;
  status: Status;
  label: string;
  variant: "primary" | "outline";
}) {
  const [state, action, pending] = useActionState<PostActionState, FormData>(
    setPostStatusAction,
    {}
  );
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center rounded-md px-4 text-xs font-medium transition-colors disabled:opacity-50",
          variant === "primary"
            ? "bg-primary text-primary-foreground shadow-sm hover:bg-[var(--reyhan-blue-700)]"
            : "border border-input bg-background hover:bg-accent"
        )}
      >
        {pending ? "..." : label}
      </button>
      {state.error && (
        <span className="ms-2 self-center text-[11px] text-destructive" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

function DeletePostForm({ postId }: { postId: string }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<PostActionState, FormData>(
    deletePostAction,
    {}
  );

  if (state.message) {
    return (
      <p className="text-xs text-[var(--reyhan-green-700)]" role="status">
        {state.message}
      </p>
    );
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
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="postId" value={postId} />
      {armed ? (
        <>
          <span className="text-xs text-muted-foreground">حذف قطعی مقاله؟ این عمل بازگشت‌پذیر نیست.</span>
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
          حذف مقاله
        </button>
      )}
      {state.error && (
        <span className="text-[11px] text-destructive" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function PostStatusActions({
  postId,
  status,
  hasContent,
}: {
  postId: string;
  status: Status;
  /** Whether the post currently has publishable content (advisory only). */
  hasContent: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "PUBLISHED" && (
          <StatusButton postId={postId} status="PUBLISHED" label="انتشار" variant="primary" />
        )}
        {status !== "ARCHIVED" && (
          <StatusButton
            postId={postId}
            status="ARCHIVED"
            label={postStatusLabels.ARCHIVED}
            variant="outline"
          />
        )}
        {status !== "DRAFT" && (
          <StatusButton
            postId={postId}
            status="DRAFT"
            label="انتقال به پیش‌نویس"
            variant="outline"
          />
        )}
        <span className="mx-1 hidden h-6 w-px bg-border sm:inline-block" aria-hidden="true" />
        <DeletePostForm postId={postId} />
      </div>

      {!hasContent && status !== "PUBLISHED" && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700" role="note">
          این مقاله محتوایی ندارد؛ بدون نوشتن محتوا قابل انتشار نیست.
        </p>
      )}
    </div>
  );
}
