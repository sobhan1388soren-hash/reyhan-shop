import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { getUserInvoices } from "@/lib/auth/account";
import { paymentStatusLabels, paymentMethodLabels } from "@/lib/auth/labels";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import type { PaymentMethod } from "@prisma/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "فاکتورها",
  alternates: { canonical: "/account/invoices" },
};

export default async function InvoicesPage() {
  const user = await requireUser();
  const invoices = await getUserInvoices(user.id);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h1 className="text-lg font-bold text-foreground">فاکتورهای من</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        فاکتور سفارش‌های خود را اینجا ببینید. شماره فاکتور همان شماره سفارش شماست.
      </p>

      <div className="mt-6">
        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            هنوز فاکتوری برای شما صادر نشده است. فاکتورها پس از ثبت سفارش در این بخش
            نمایش داده می‌شوند.
          </p>
        ) : (
          <ul className="space-y-4">
            {invoices.map((invoice, i) => (
              <li key={invoice.orderId} className="rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      فاکتور{" "}
                      <span dir="ltr" className="tabular-nums">
                        {invoice.orderNumber}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFaDate(invoice.createdAt)}
                      {invoice.paidAt ? ` · پرداخت در ${formatFaDate(invoice.paidAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {invoice.paymentMethod && (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {paymentMethodLabels[invoice.paymentMethod as PaymentMethod] ??
                          invoice.paymentMethod}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        invoice.paymentStatus === "PAID"
                          ? "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]"
                          : invoice.paymentStatus === "PENDING"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {paymentStatusLabels[invoice.paymentStatus]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatPriceToman(invoice.totalAmount)}
                  </p>
                  <Link
                    href={`/account/orders/${invoice.orderId}`}
                    className="inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    مشاهده سفارش
                  </Link>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  شماره فاکتور: {toFaDigits(i + 1)} از {toFaDigits(invoices.length)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
