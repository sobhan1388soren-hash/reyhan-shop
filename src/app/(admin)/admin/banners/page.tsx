import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import {
  parseAdminListPage,
  parseAdminSearchTerm,
  parseEnumFilter,
  parseSortOption,
  firstParam,
  type AdminListSearchParams,
} from "@/lib/admin/list";
import {
  getAdminBanners,
  ADMIN_BANNER_SORTS,
  type AdminBannerRow,
  type AdminBannerSort,
} from "@/lib/marketing/banner-service";
import { bannerPlacementLabels } from "@/lib/admin/labels";
import { ADMIN_BANNER_PLACEMENT_OPTIONS } from "@/lib/admin/options";
import {
  AdminListToolbar,
  AdminTable,
  AdminCardList,
  AdminListFooter,
  AdminListErrorState,
  AdminRowActions,
  type AdminColumn,
} from "@/components/admin/admin-list";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminSearchField } from "@/components/admin/admin-search-field";
import { AdminSelectFilter } from "@/components/admin/admin-select-filter";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatFaDate } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "بنرها و هیرو",
};

const BASE_PATH = "/admin/banners";

function BannerThumb({ row }: { row: AdminBannerRow }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {row.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[10px] text-muted-foreground">بدون تصویر</span>
      )}
    </span>
  );
}

function BannerIdentity({ row }: { row: AdminBannerRow }) {
  return (
    <div className="flex items-center gap-3">
      <BannerThumb row={row} />
      <div className="min-w-0">
        <Link
          href={`${BASE_PATH}/${row.id}`}
          className="block truncate font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
        >
          {row.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {bannerPlacementLabels[row.placement]}
        </p>
      </div>
    </div>
  );
}

const columns: AdminColumn<AdminBannerRow>[] = [
  { key: "banner", header: "بنر", cell: (row) => <BannerIdentity row={row} /> },
  {
    key: "placement",
    header: "محل نمایش",
    cell: (row) => (
      <AdminStatusBadge tone="info">{bannerPlacementLabels[row.placement]}</AdminStatusBadge>
    ),
  },
  {
    key: "order",
    header: "ترتیب",
    secondary: true,
    className: "text-center",
    cell: (row) => <span className="tabular-nums text-muted-foreground">{row.sortOrder}</span>,
  },
  {
    key: "status",
    header: "وضعیت",
    cell: (row) => (
      <AdminStatusBadge tone={row.isActive ? "success" : "neutral"}>
        {row.isActive ? "فعال" : "غیرفعال"}
      </AdminStatusBadge>
    ),
  },
  {
    key: "updatedAt",
    header: "آخرین بهروزرسانی",
    secondary: true,
    cell: (row) => <span className="text-xs text-muted-foreground">{formatFaDate(row.updatedAt)}</span>,
  },
  {
    key: "actions",
    header: "",
    className: "text-end",
    cell: (row) => (
      <AdminRowActions>
        <Link
          href={`${BASE_PATH}/${row.id}`}
          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
          aria-label={`مدیریت بنر ${row.title}`}
        >
          مدیریت
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<AdminListSearchParams>;
}) {
  await requireAdmin();
  const resolved = await searchParams;

  const pagination = parseAdminListPage(resolved);
  const q = parseAdminSearchTerm(firstParam(resolved.q));
  const placement = parseEnumFilter(
    firstParam(resolved.placement),
    ADMIN_BANNER_PLACEMENT_OPTIONS.map((o) => o.value)
  );
  const sort = parseSortOption<AdminBannerSort>(
    firstParam(resolved.sort),
    ADMIN_BANNER_SORTS,
    "created_desc"
  );

  const result = await getAdminBanners({ ...pagination, q, placement, sort });

  return (
    <div>
      <AdminPageHeader
        title="بنرها و هیرو"
        description="مدیریت هیرو صفحه اصلی و بنرهای تبلیغاتی. فقط یک هیرو فعال نمایش داده می‌شود؛ بدون هیرو، محتوای پیش‌فرض و واقعی صفحه نمایش داده می‌شود."
        actions={
          <Link
            href={`${BASE_PATH}/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            بنر جدید
          </Link>
        }
      />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <AdminListToolbar
            search={
              <AdminSearchField
                label="جستجوی بنر"
                placeholder="عنوان بنر..."
                initValue={q ?? ""}
              />
            }
            filters={
              <>
                <AdminSelectFilter
                  name="placement"
                  label="فیلتر محل نمایش"
                  allLabel="همه محل‌ها"
                  options={ADMIN_BANNER_PLACEMENT_OPTIONS}
                  value={placement ?? ""}
                />
                <AdminSelectFilter
                  name="sort"
                  label="ترتیب نمایش"
                  allLabel="ترتیب پیش‌فرض"
                  options={[
                    { value: "created_asc", label: "قدیمی‌ترین" },
                    { value: "order_asc", label: "ترتیب نمایش" },
                    { value: "title_asc", label: "عنوان (الف → ی)" },
                  ]}
                  value={sort === "created_desc" ? "" : sort}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="بنری یافت نشد"
                description={
                  q || placement
                    ? "هیچ بنری با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز بنری ساخته نشده است. با «بنر جدید» هیرو صفحه اصلی یا اولین بنر تبلیغاتی را بسازید."
                }
                action={
                  !q && !placement ? (
                    <Link
                      href={`${BASE_PATH}/new`}
                      className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
                    >
                      ساخت بنر
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AdminTable caption="فهرست بنرها" columns={columns} rows={result.rows} keyOf={(r) => r.id} />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست بنرها"
                renderCard={(row) => (
                  <div className="p-4">
                    <BannerIdentity row={row} />
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge tone="info">
                          {bannerPlacementLabels[row.placement]}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone={row.isActive ? "success" : "neutral"}>
                          {row.isActive ? "فعال" : "غیرفعال"}
                        </AdminStatusBadge>
                      </div>
                      <Link
                        href={`${BASE_PATH}/${row.id}`}
                        className="text-xs font-medium text-[var(--reyhan-blue-600)] hover:underline"
                      >
                        مدیریت
                      </Link>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          <AdminListFooter meta={result.meta} basePath={BASE_PATH} searchParams={resolved} itemLabel="بنر" />
        </div>
      )}
    </div>
  );
}
