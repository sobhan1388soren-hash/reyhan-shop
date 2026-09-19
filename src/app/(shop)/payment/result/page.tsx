import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { getUserOrderById } from "@/lib/auth/account";
import { gatewayUxCopy, type GatewayUxState } from "@/lib/payments/ux";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { PayAgainButton } from "@/components/payments/pay-again-button";

// /payment/result — Persian/RTL gateway result page. Every state derives
// from server-side verification (or a safe ambiguous state); the query
// params only pick presentation, never payment truth.

export const metadata: Metadata = {
  title: "نتیجه پرداخت",
  robots: { index: false, follow: false },
};

const STATE_PARAM_TO_UX: Record<string, GatewayUxState> = {
  success: "success",
  cancelled: "cancelled",
  failed: "failed",
  verifying: "verifying",
  "already-paid": "already-paid",
  "gateway-error": "gateway-error",
  redirecting: "redirecting",
};

const toneClasses: Record<
  GatewayUxState,
  { frame: string; badge: string; icon: string }
> = {
  success: {
    frame: "border-[var(--reyhan-green-500)]/40 bg-[var(--reyhan-green-50)]",
    badge: "bg-[var(--reyhan-green-100)] text-[var(--reyhan-green-700)]",
    icon: "text-[var(--reyhan-green-600)]",
  },
  "already-paid": {
    frame: "border-[var(--reyhan-green-500)]/40 bg-[var(--reyhan-green-50)]",
    badge: "bg-[var(--reyhan-green-100)] text-[var(--reyhan-green-700)]",
    icon: "text-[var(--reyhan-green-600)]",
  },
  redirecting: {
    frame: "border-[var(--reyhan-blue-500)]/40 bg-[var(--reyhan-blue-50)]",
    badge: "bg-[var(--reyhan-blue-100)] text-[var(--reyhan-blue-700)]",
    icon: "text-[var(--reyhan-blue-600)]",
  },
  verifying: {
    frame: "border-amber-400/50 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    icon: "text-amber-600",
  },
  cancelled: {
    frame: "border-amber-400/50 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    icon: "text-amber-600",
  },
  failed: {
    frame: "border-destructive/30 bg-destructive/10",
    badge: "bg-destructive/15 text-destructive",
    icon: "text-destructive",
  },
  "gateway-error": {
    frame: "border-destructive/30 bg-destructive/10",
    badge: "bg-destructive/15 text-destructive",
    icon: "text-destructive",
  },
};

function StateIcon({ state }: { state: GatewayUxState }) {
  if (state === "success" || state === "already-paid") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "verifying" || state === "redirecting") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 animate-spin" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === "cancelled") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type PageProps = {
  searchParams: Promise<{ state?: string; order?: string; retry?: string }>;
};

export default async function PaymentResultPage({ searchParams }: PageProps) {
  await requireUser();
  const { state: stateParam, order: orderId, retry } = await searchParams;

  const state = (stateParam && STATE_PARAM_TO_UX[stateParam]) || "gateway-error";
  const copy = gatewayUxCopy(state);
  const tone = toneClasses[state];

  // Ownership-scoped order lookup — a foreign/unknown id shows the plain
  // result card without any order data.
  const order = orderId ? await getUserOrderById((await getCurrentUserSafe()) ?? "", orderId) : null;

  const showRetry = retry === "1" && !!order;
  const isPositive = state === "success" || state === "already-paid";

  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      <div className={cn("rounded-xl border px-5 py-6 text-center shadow-card sm:px-8", tone.frame)}>
        <span
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            tone.badge
          )}
        >
          <StateIcon state={state} />
        </span>
        <h1 className="mt-4 text-lg font-bold text-foreground">{copy.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-foreground/80">
          {copy.description}
        </p>

        {order && (
          <dl className="mt-5 space-y-2 rounded-lg border border-input/60 bg-background/70 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">شماره سفارش</dt>
              <dd dir="ltr" className="font-semibold tabular-nums text-foreground">
                {order.orderNumber}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">مبلغ سفارش</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatPriceToman(order.totalAmount)}
              </dd>
            </div>
            {isPositive && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">وضعیت پرداخت</dt>
                <dd className="font-semibold text-[var(--reyhan-green-700)]">پرداخت شده</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-6 flex flex-col items-center gap-2.5">
          {order ? (
            <Link
              href={`/account/orders/${order.id}`}
              className="inline-flex h-11 w-full max-w-xs items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
            >
              مشاهده جزئیات سفارش
            </Link>
          ) : (
            <Link
              href="/account/orders"
              className="inline-flex h-11 w-full max-w-xs items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
            >
              سفارش‌های من
            </Link>
          )}
          {showRetry && (
            <PayAgainButton orderId={order!.id} className="max-w-xs" />
          )}
        </div>
      </div>

      {state === "verifying" && (
        <p className="rounded-xl border border-dashed px-4 py-3 text-center text-xs leading-6 text-muted-foreground">
          نیازی به اقدام یا پرداخت مجدد نیست؛ نتیجه نهایی طی چند دقیقه در صفحه سفارش
          مشخص می‌شود. شماره پیگیری شما: {toFaDigits(1)}
        </p>
      )}
    </div>
  );
}

// The requireUser() above redirects when signed out; this helper exists so
// the order lookup stays inside the same render pass without a second
// redirect-capable call.
async function getCurrentUserSafe(): Promise<string | null> {
  const { getCurrentUser } = await import("@/lib/auth/dal");
  const user = await getCurrentUser();
  return user?.id ?? null;
}
