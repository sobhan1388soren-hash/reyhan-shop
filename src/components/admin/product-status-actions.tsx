"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  setProductStatusAction,
  deleteProductAction,
  type ProductActionState,
} from "@/app/actions/products";
import { evaluateProductPublish } from "@/lib/admin/product-rules";
import { cn } from "@/lib/utils";

// ProductStatusActions — publish / unpublish / archive + guarded delete.
// Authorization and validation are server-side; this island only renders
// state and submits. The variant-less warning is ADVISORY (activation is
// never blocked server-side).

function StatusButton({
  productId,
  status,
  label,
  variant,
}: {
  productId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  label: string;
  variant: "primary" | "outline" | "danger";
}) {
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    setProductStatusAction,
    {}
  );
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center rounded-md px-4 text-xs font-medium transition-colors disabled:opacity-50",
          variant === "primary" &&
            "bg-primary text-primary-foreground shadow-sm hover:bg-[var(--reyhan-blue-700)]",
          variant === "outline" && "border border-input bg-background hover:bg-accent",
          variant === "danger" && "border border-destructive/30 text-destructive hover:bg-destructive/10"
        )}
      >
        {pending ? "..." : label}
      </button>
      {state.error && <span className="ms-2 self-center text-[11px] text-destructive">{state.error}</span>}
    </form>
  );
}

function DeleteProductForm({ productId }: { productId: string }) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<ProductActionState, FormData>(
    deleteProductAction,
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
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="productId" value={productId} />
      {armed ? (
        <>
          <span className="text-xs text-muted-foreground">حذف قطعی محصول؟ این عمل بازگشت‌پذیر نیست.</span>
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
          حذف محصول
        </button>
      )}
      {state.error && <span className="text-[11px] text-destructive" role="alert">{state.error}</span>}
    </form>
  );
}

export function ProductStatusActions({
  productId,
  status,
  variantCount,
  orderItemCount,
}: {
  productId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  variantCount: number;
  orderItemCount: number;
}) {
  const readiness = evaluateProductPublish({ variantCount });
  const noVariants = !readiness.allowed;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "ACTIVE" && (
          <StatusButton productId={productId} status="ACTIVE" label="فعال‌سازی" variant="primary" />
        )}
        {status !== "ARCHIVED" && (
          <StatusButton productId={productId} status="ARCHIVED" label="آرشیو" variant="outline" />
        )}
        {status !== "DRAFT" && (
          <StatusButton productId={productId} status="DRAFT" label="انتقال به پیش‌نویس" variant="outline" />
        )}
        <span className="mx-1 hidden h-6 w-px bg-border sm:inline-block" aria-hidden="true" />
        {orderItemCount === 0 ? (
          <DeleteProductForm productId={productId} />
        ) : (
          <span className="text-[11px] text-muted-foreground">
            این محصول سابقه سفارش دارد و حذف نمی‌شود؛ برای پنهان‌کردن آن را آرشیو کنید.
          </span>
        )}
      </div>

      {noVariants && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700" role="note">
          این محصول هنوز گونه‌ای ندارد؛ تا زمانی که گونه اضافه نشود، در فروشگاه «ناموجود» نمایش داده می‌شود.
        </p>
      )}
    </div>
  );
}