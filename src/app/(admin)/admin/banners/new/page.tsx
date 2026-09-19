import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BannerForm, emptyBannerDraft } from "@/components/admin/banner-form";

export const metadata: Metadata = {
  title: "بنر جدید",
};

export default async function NewBannerPage() {
  await requireAdmin();

  return (
    <div>
      <AdminPageHeader
        title="بنر جدید"
        description="هیرو صفحه اصلی یا یک بنر تبلیغاتی بسازید. تصاویر فقط از طریق آدرس (URL) وارد می‌شوند."
        actions={
          <Link
            href="/admin/banners"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            بازگشت به بنرها
          </Link>
        }
      />
      <BannerForm mode="create" draft={emptyBannerDraft} />
    </div>
  );
}
