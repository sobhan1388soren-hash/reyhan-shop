"use client";

// Pay button — POSTs to /api/payments/start with only the order id (the
// payable amount is re-derived server-side, never sent from here) and
// redirects the browser to the gateway's hosted checkout. Shows the
// "در حال انتقال به درگاه" state while the request is in flight.

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type PayAgainButtonProps = {
  orderId: string;
  className?: string;
  label?: string;
};

export function PayAgainButton({ orderId, className, label = "تلاش دوباره برای پرداخت" }: PayAgainButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);

  async function start() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.status === 401) {
        router.push("/login?next=/account/orders");
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { redirectUrl?: string; alreadyPaid?: boolean; orderId?: string }
        | null;
      if (res.ok && body?.redirectUrl) {
        // Hosted gateway page — full navigation, not a client route.
        window.location.assign(body.redirectUrl);
        return;
      }
      if (res.ok && body?.alreadyPaid) {
        router.push(`/payment/result?state=already-paid&order=${encodeURIComponent(body.orderId ?? orderId)}`);
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors",
          "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {pending ? "در حال انتقال به درگاه…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          خطای ارتباط با درگاه؛ لطفاً دوباره تلاش کنید.
        </p>
      )}
    </div>
  );
}
