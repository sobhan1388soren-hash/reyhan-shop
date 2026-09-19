import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminBannerById } from "@/lib/marketing/banner-service";
import { bannerPlacementLabels } from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { BannerForm, draftFromBanner } from "@/components/admin/banner-form";
import { BannerActions } from "@/components/admin/banner-actions";
import { formatFaDate } from "@/lib/catalog/format";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: "مدیریت بنر",
    template: `%s | ${SITE_NAME}`,
  },
};

type PageProps = {
  params: Promise<{ bannerId: string }>;
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminBannerDetailPage({ params }: PageProps) {
  const { bannerId } = await params;
  await requireAdmin();
  const result = await getAdminBannerById(bannerId);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="مدیریت بنر" />
        <AdminListErrorState onRetryHref="/admin/banners" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const banner = result.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={banner.title}
        description={`ایجاد: ${formatFaDate(banner.createdAt)} · آخرین به‌روزرسانی: ${formatFaDate(banner.updatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <AdminStatusBadge tone="info" className="px-3 py-1 text-xs">
              {bannerPlacementLabels[banner.placement]}
            </AdminStatusBadge>
            <AdminStatusBadge tone={banner.isActive ? "success" : "neutral"} className="px-3 py-1 text-xs">
              {banner.isActive ? "فعال" : "غیرفعال"}
            </AdminStatusBadge>
            <Link
              href="/admin/banners"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              بازگشت
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="پیش‌نمایش">
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-l from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)] p-4 text-center">
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="relative">
                <p className="text-sm font-bold text-foreground">{banner.title}</p>
                {banner.description && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
                    {banner.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            پیش‌نمایش تقریبی است؛ نسخه نهایی روی صفحه اصلی با چیدمان واقعی نمایش داده می‌شود.
          </p>
        </SectionCard>

        <SectionCard title="وضعیت و حذف">
          <div className="mt-4">
            <BannerActions bannerId={banner.id} isActive={banner.isActive} />
          </div>
        </SectionCard>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">ویرایش بنر</h2>
        <BannerForm mode="edit" bannerId={banner.id} draft={draftFromBanner(banner)} />
      </div>
    </div>
  );
}
