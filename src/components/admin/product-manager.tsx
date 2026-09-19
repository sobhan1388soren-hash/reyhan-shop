"use client";

import * as React from "react";
import type { AdminProductDetail } from "@/lib/admin/product-service";
import { VariantsManager } from "@/components/admin/variants-manager";
import { SpecificationManager } from "@/components/admin/specification-manager";
import { MediaManager } from "@/components/admin/media-manager";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

// ProductManager — tab shell for a product's operational sections. Data is
// loaded server-side and passed in; this island owns only tab selection
// (no second validation or authorization authority).

type TabKey = "variants" | "specifications" | "media" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "variants", label: "گونه‌ها، قیمت و موجودی" },
  { key: "specifications", label: "مشخصات" },
  { key: "media", label: "تصاویر و رسانه" },
  { key: "history", label: "تاریخچه" },
];

export function ProductManager({
  product,
  canViewCost,
}: {
  product: AdminProductDetail;
  canViewCost: boolean;
}) {
  const [tab, setTab] = React.useState<TabKey>("variants");

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div role="tablist" aria-label="بخش‌های مدیریت محصول" className="flex flex-wrap gap-1 border-b bg-muted/20 p-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              id={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-5">
        {tab === "variants" && (
          <div role="tabpanel" id="panel-variants" aria-labelledby="tab-variants">
            <VariantsManager productId={product.id} variants={product.variants} canViewCost={canViewCost} />
          </div>
        )}

        {tab === "specifications" && (
          <div role="tabpanel" id="panel-specifications" aria-labelledby="tab-specifications">
            <SpecificationManager productId={product.id} specifications={product.specifications} />
          </div>
        )}

        {tab === "media" && (
          <div role="tabpanel" id="panel-media" aria-labelledby="tab-media">
            <MediaManager product={product} variants={product.variants} />
          </div>
        )}

        {tab === "history" && (
          <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-foreground">تاریخچه تغییر قیمت</h3>
              {product.priceHistory.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">هنوز تغییر قیمتی ثبت نشده است.</p>
              ) : (
                <ul className="mt-3 divide-y rounded-lg border" aria-label="تاریخچه قیمت">
                  {product.priceHistory.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{entry.variantTitle}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {formatPriceToman(entry.price)}
                          {entry.compareAtPrice != null && (
                            <>
                              {" · خط‌خورده: "}
                              {formatPriceToman(entry.compareAtPrice)}
                            </>
                          )}
                          {entry.changedBy && <> · {entry.changedBy}</>}
                        </p>
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatFaDate(entry.changedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground">تاریخچه تراکنش‌های موجودی</h3>
              {product.inventoryTransactions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">هنوز تراکنش موجودی ثبت نشده است.</p>
              ) : (
                <ul className="mt-3 divide-y rounded-lg border" aria-label="تراکنش‌های موجودی">
                  {product.inventoryTransactions.map((tx) => (
                    <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{tx.variantTitle}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          نوع: {tx.reason}
                          {tx.orderId && <> · سفارش: <span dir="ltr">{tx.orderId}</span></>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            tx.change >= 0 ? "text-[var(--reyhan-green-700)]" : "text-destructive"
                          )}
                          dir="ltr"
                        >
                          {tx.change >= 0 ? "+" : "−"}
                          {toFaDigits(Math.abs(tx.change))}
                        </span>
                        <span className="text-muted-foreground">{formatFaDate(tx.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              حداکثر ۵۰ رکورد اخیر هر بخش نمایش داده می‌شود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}