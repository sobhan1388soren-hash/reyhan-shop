import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminDiscountById } from "@/lib/admin/discount-admin-service";
import { discountStatusLabels, discountStatusTones } from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { DiscountForm, draftFromDiscount } from "@/components/admin/discount-form";
import { DiscountStatusToggle } from "@/components/admin/discount-status-toggle";
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: "مدیریت کد تخفیف",
    template: `%s | ${SITE_NAME}`,
  },
};

type PageProps = {
  params: Promise<{ discountId: string }>;
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminDiscountDetailPage({ params }: PageProps) {
  const { discountId } = await params;
  await requireAdmin();
  const result = await getAdminDiscountById(discountId);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="مدیریت کد تخفیف" />
        <AdminListErrorState onRetryHref="/admin/discounts" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const discount = result.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          <>
            کد تخفیف{" "}
            <span dir="ltr" className="tabular-nums">
              {discount.code}
            </span>
          </>
        }
        description={`ایجاد: ${formatFaDate(discount.createdAt)} · آخرین به‌روزرسانی: ${formatFaDate(discount.updatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <AdminStatusBadge tone={discountStatusTones[discount.displayStatus]} className="px-3 py-1 text-xs">
              {discountStatusLabels[discount.displayStatus]}
            </AdminStatusBadge>
            <Link
              href="/admin/discounts"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              بازگشت
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="وضعیت">
          <div className="mt-4 space-y-3">
            <DiscountStatusToggle discountId={discount.id} isActive={discount.isActive} />
            <p className="text-xs text-muted-foreground">
              با غیرفعال‌کردن، کد در فروشگاه قابل استفاده نخواهد بود.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="استفاده">
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">تعداد استفاده</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {toFaDigits(discount.usedCount)}
                {discount.maxUses != null ? ` / ${toFaDigits(discount.maxUses)}` : " / نامحدود"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">سقف هر کاربر</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {discount.maxUsesPerUser != null ? toFaDigits(discount.maxUsesPerUser) : "نامحدود"}
              </dd>
            </div>
            {discount.minOrderAmount != null && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">حداقل مبلغ سفارش</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {formatPriceToman(discount.minOrderAmount)}
                </dd>
              </div>
            )}
            {discount.maxDiscountAmount != null && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">سقف مبلغ تخفیف</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {formatPriceToman(discount.maxDiscountAmount)}
                </dd>
              </div>
            )}
          </dl>

          {discount.usages.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">هنوز استفاده‌ای از این کد ثبت نشده است.</p>
          ) : (
            <>
              <ul className="mt-4 divide-y rounded-lg border" aria-label="آخرین استفاده‌ها">
                {discount.usages.map((usage) => (
                  <li key={usage.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                    <span className="text-muted-foreground">
                      {usage.orderId ? (
                        <Link
                          href={`/admin/orders/${usage.orderId}`}
                          className="font-medium text-foreground hover:underline"
                          dir="ltr"
                        >
                          سفارش {usage.orderId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-muted-foreground">{formatFaDate(usage.usedAt)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">حداکثر ۵۰ استفاده اخیر نمایش داده می‌شود.</p>
            </>
          )}
        </SectionCard>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">ویرایش کد تخفیف</h2>
        <DiscountForm mode="edit" discountId={discount.id} draft={draftFromDiscount(discount)} />
      </div>
    </div>
  );
}