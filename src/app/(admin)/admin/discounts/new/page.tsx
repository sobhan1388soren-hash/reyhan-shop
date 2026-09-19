import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DiscountForm, emptyDiscountDraft } from "@/components/admin/discount-form";

export const metadata: Metadata = {
  title: "کد تخفیف جدید",
};

export default async function NewDiscountPage() {
  await requireAdmin();

  return (
    <div>
      <AdminPageHeader
        title="کد تخفیف جدید"
        description="نوع تخفیف، شرایط استفاده و بازه اعتبار را تعیین کنید."
        actions={
          <Link
            href="/admin/discounts"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به تخفیف‌ها
          </Link>
        }
      />
      <DiscountForm mode="create" draft={emptyDiscountDraft} />
    </div>
  );
}