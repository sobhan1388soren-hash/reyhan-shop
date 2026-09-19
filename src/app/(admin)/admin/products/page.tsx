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
  getAdminProducts,
  getAdminCategoryOptions,
  ADMIN_PRODUCT_SORTS,
  type AdminProductRow,
  type AdminProductSort,
} from "@/lib/admin/product-service";
import { productStatusLabels, productStatusTones, type StatusTone } from "@/lib/admin/labels";
import {
  ADMIN_PRODUCT_STATUS_OPTIONS,
  ADMIN_PRODUCT_SORT_OPTIONS,
} from "@/lib/admin/options";
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
import { formatPriceToman, formatNumber, formatFaDate } from "@/lib/catalog/format";
import { availabilityLabel } from "@/lib/catalog/availability";
import type { AvailabilityState } from "@/lib/catalog/types";

export const metadata: Metadata = {
  title: "محصولات",
};

const BASE_PATH = "/admin/products";

const availabilityTones: Record<AvailabilityState, StatusTone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "neutral",
  unavailable: "neutral",
};

function formatPriceRange(row: AdminProductRow): string {
  if (row.priceFrom == null) return "—";
  if (row.priceTo != null && row.priceTo !== row.priceFrom) {
    return `${formatPriceToman(row.priceFrom)} تا ${formatPriceToman(row.priceTo)}`;
  }
  return formatPriceToman(row.priceFrom);
}

function ProductThumb({ row }: { row: AdminProductRow }) {
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

function ProductIdentity({ row }: { row: AdminProductRow }) {
  return (
    <div className="flex items-center gap-3">
      <ProductThumb row={row} />
      <div className="min-w-0">
        <Link
          href={`${BASE_PATH}/${row.id}`}
          className="block truncate font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
        >
          {row.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          /{row.slug}
        </p>
      </div>
    </div>
  );
}

const columns: AdminColumn<AdminProductRow>[] = [
  { key: "product", header: "محصول", cell: (row) => <ProductIdentity row={row} /> },
  {
    key: "category",
    header: "دستهبندی",
    secondary: true,
    cell: (row) =>
      row.categories.length === 0 ? (
        <span className="text-xs text-muted-foreground">بدون دسته</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {row.categories.map((c) => c.name).join("، ")}
        </span>
      ),
  },
  {
    key: "price",
    header: "قیمت",
    cell: (row) => <span className="whitespace-nowrap tabular-nums text-foreground">{formatPriceRange(row)}</span>,
  },
  {
    key: "stock",
    header: "موجودی",
    secondary: true,
    className: "text-center",
    cell: (row) => (
      <div className="flex flex-col items-center gap-0.5">
        <span className="tabular-nums text-foreground">{formatNumber(row.totalStock)}</span>
        <span className="text-[11px] text-muted-foreground">
          {row.activeVariantCount} از {row.variantCount} گونه
        </span>
      </div>
    ),
  },
  {
    key: "availability",
    header: "قابل عرضه",
    cell: (row) => (
      <AdminStatusBadge tone={availabilityTones[row.availability]}>
        {availabilityLabel(row.availability)}
      </AdminStatusBadge>
    ),
  },
  {
    key: "status",
    header: "وضعیت",
    cell: (row) => (
      <AdminStatusBadge tone={productStatusTones[row.status]}>
        {productStatusLabels[row.status]}
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
          aria-label={`مدیریت محصول ${row.title}`}
        >
          مدیریت
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<AdminListSearchParams>;
}) {
  await requireAdmin();
  const resolved = await searchParams;

  const pagination = parseAdminListPage(resolved);
  const q = parseAdminSearchTerm(firstParam(resolved.q));
  const status = parseEnumFilter(
    firstParam(resolved.status),
    ADMIN_PRODUCT_STATUS_OPTIONS.map((o) => o.value)
  );
  const featured = firstParam(resolved.featured) === "1";
  const categoryId = firstParam(resolved.category) || undefined;
  const sort = parseSortOption<AdminProductSort>(
    firstParam(resolved.sort),
    ADMIN_PRODUCT_SORTS,
    "updated_desc"
  );

  const [result, categoryOptions] = await Promise.all([
    getAdminProducts({ ...pagination, q, status, categoryId, featured, sort }),
    getAdminCategoryOptions(),
  ]);

  const categorySelectOptions =
    categoryOptions.state === "ok"
      ? categoryOptions.categories.map((c) => ({
          value: c.id,
          label: `${"— ".repeat(Math.min(c.level, 5))}${c.name}`,
        }))
      : [];

  return (
    <div>
      <AdminPageHeader
        title="محصولات"
        description="ساخت، ویرایش و مدیریت محصولات فروشگاه همراه با گونهها، ویژگیها، قیمت، موجودی و تصاویر."
        actions={
          <Link
            href={`${BASE_PATH}/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            محصول جدید
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
                label="جستجوی محصول"
                placeholder="نام، اسلاگ یا کد کالا..."
                initValue={q ?? ""}
              />
            }
            filters={
              <>
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت"
                  allLabel="همه وضعیتها"
                  options={ADMIN_PRODUCT_STATUS_OPTIONS}
                  value={status ?? ""}
                />
                <AdminSelectFilter
                  name="category"
                  label="فیلتر دستهبندی"
                  allLabel="همه دستهبندیها"
                  options={categorySelectOptions}
                  value={categoryId ?? ""}
                />
                <AdminSelectFilter
                  name="sort"
                  label="ترتیب نمایش"
                  allLabel="ترتیب پیشفرض"
                  options={ADMIN_PRODUCT_SORT_OPTIONS}
                  value={sort === "updated_desc" ? "" : sort}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="محصولی یافت نشد"
                description={
                  q || status || categoryId || featured
                    ? "هیچ محصولی با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز محصولی ساخته نشده است. با «محصول جدید» اولین محصول فروشگاه را بسازید."
                }
                action={
                  !q && !status && !categoryId && !featured ? (
                    <Link
                      href={`${BASE_PATH}/new`}
                      className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
                    >
                      ساخت محصول
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AdminTable caption="فهرست محصولات" columns={columns} rows={result.rows} keyOf={(r) => r.id} />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست محصولات"
                renderCard={(row) => (
                  <div className="p-4">
                    <ProductIdentity row={row} />
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge tone={productStatusTones[row.status]}>
                          {productStatusLabels[row.status]}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone={availabilityTones[row.availability]}>
                          {availabilityLabel(row.availability)}
                        </AdminStatusBadge>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{formatPriceRange(row)}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      موجودی: {formatNumber(row.totalStock)} · {row.variantCount} گونه
                    </p>
                  </div>
                )}
              />
            </>
          )}

          <AdminListFooter meta={result.meta} basePath={BASE_PATH} searchParams={resolved} itemLabel="محصول" />
        </div>
      )}
    </div>
  );
}