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
  getAdminDiscounts,
  ADMIN_DISCOUNT_SORTS,
  type AdminDiscountRow,
  type AdminDiscountSort,
} from "@/lib/admin/discount-admin-service";
import {
  discountStatusLabels,
  discountStatusTones,
  discountTypeLabels,
} from "@/lib/admin/labels";
import { DISCOUNT_TYPES } from "@/lib/admin/discount-admin-rules";
import {
  ADMIN_DISCOUNT_STATUS_OPTIONS,
  ADMIN_DISCOUNT_TYPE_OPTIONS,
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
import { formatFaDate, formatPriceToman, toFaDigits } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "تخفیف‌ها",
};

const BASE_PATH = "/admin/discounts";

function formatValue(row: AdminDiscountRow): string {
  if (row.type === "PERCENTAGE") return `${toFaDigits(row.value)}٪`;
  if (row.type === "FIXED_AMOUNT") return formatPriceToman(row.value);
  return "ارسال رایگان";
}

function formatUsage(row: AdminDiscountRow): string {
  return row.maxUses != null
    ? `${toFaDigits(row.usedCount)} / ${toFaDigits(row.maxUses)}`
    : `${toFaDigits(row.usedCount)} / نامحدود`;
}

function formatValidity(row: AdminDiscountRow): string {
  if (!row.startsAt && !row.endsAt) return "بدون محدودیت";
  if (row.endsAt) return `تا ${formatFaDate(row.endsAt)}`;
  return `از ${formatFaDate(row.startsAt!)}`;
}

const columns: AdminColumn<AdminDiscountRow>[] = [
  {
    key: "code",
    header: "کد",
    cell: (row) => (
      <Link
        href={`${BASE_PATH}/${row.id}`}
        className="font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
        dir="ltr"
      >
        {row.code}
      </Link>
    ),
  },
  {
    key: "type",
    header: "نوع",
    cell: (row) => <span className="text-xs text-muted-foreground">{discountTypeLabels[row.type]}</span>,
  },
  {
    key: "value",
    header: "مقدار",
    cell: (row) => <span className="whitespace-nowrap font-medium tabular-nums">{formatValue(row)}</span>,
  },
  {
    key: "usage",
    header: "استفاده",
    secondary: true,
    className: "text-center",
    cell: (row) => <span className="tabular-nums text-muted-foreground">{formatUsage(row)}</span>,
  },
  {
    key: "status",
    header: "وضعیت",
    cell: (row) => (
      <AdminStatusBadge tone={discountStatusTones[row.displayStatus]}>
        {discountStatusLabels[row.displayStatus]}
      </AdminStatusBadge>
    ),
  },
  {
    key: "validity",
    header: "اعتبار",
    secondary: true,
    cell: (row) => <span className="text-xs text-muted-foreground">{formatValidity(row)}</span>,
  },
  {
    key: "createdAt",
    header: "تاریخ ایجاد",
    secondary: true,
    cell: (row) => <span className="text-xs text-muted-foreground">{formatFaDate(row.createdAt)}</span>,
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
          aria-label={`مدیریت کد ${row.code}`}
        >
          مدیریت
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminDiscountsPage({
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
    ADMIN_DISCOUNT_STATUS_OPTIONS.map((o) => o.value)
  );
  const type = parseEnumFilter(firstParam(resolved.type), DISCOUNT_TYPES);
  const sort = parseSortOption<AdminDiscountSort>(
    firstParam(resolved.sort),
    ADMIN_DISCOUNT_SORTS,
    "created_desc"
  );

  const result = await getAdminDiscounts({ ...pagination, q, status, type, sort });

  return (
    <div>
      <AdminPageHeader
        title="تخفیف‌ها"
        description="ساخت و مدیریت کدهای تخفیف فروشگاه، همراه با وضعیت اعتبار و میزان استفاده."
        actions={
          <Link
            href={`${BASE_PATH}/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            کد تخفیف جدید
          </Link>
        }
      />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <AdminListToolbar
            search={<AdminSearchField label="جستجوی کد تخفیف" placeholder="کد تخفیف..." initValue={q ?? ""} />}
            filters={
              <>
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_DISCOUNT_STATUS_OPTIONS}
                  value={status ?? ""}
                />
                <AdminSelectFilter
                  name="type"
                  label="فیلتر نوع"
                  allLabel="همه انواع"
                  options={ADMIN_DISCOUNT_TYPE_OPTIONS}
                  value={type ?? ""}
                />
                <AdminSelectFilter
                  name="sort"
                  label="ترتیب نمایش"
                  allLabel="ترتیب پیش‌فرض"
                  options={[
                    { value: "created_asc", label: "قدیمی‌ترین" },
                    { value: "code_asc", label: "کد (الف → ی)" },
                    { value: "usage_desc", label: "بیشترین استفاده" },
                  ]}
                  value={sort === "created_desc" ? "" : sort}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="کد تخفیفی یافت نشد"
                description={
                  q || status || type
                    ? "هیچ کد تخفیفی با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز کد تخفیفی ساخته نشده است. با «کد تخفیف جدید» اولین کد را بسازید."
                }
                action={
                  !q && !status && !type ? (
                    <Link
                      href={`${BASE_PATH}/new`}
                      className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
                    >
                      ساخت کد تخفیف
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AdminTable caption="فهرست کدهای تخفیف" columns={columns} rows={result.rows} keyOf={(r) => r.id} />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست کدهای تخفیف"
                renderCard={(row) => (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`${BASE_PATH}/${row.id}`}
                        className="text-sm font-semibold text-foreground hover:underline"
                        dir="ltr"
                      >
                        {row.code}
                      </Link>
                      <AdminStatusBadge tone={discountStatusTones[row.displayStatus]}>
                        {discountStatusLabels[row.displayStatus]}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {discountTypeLabels[row.type]} · {formatValue(row)} · استفاده {formatUsage(row)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatValidity(row)}</p>
                  </div>
                )}
              />
            </>
          )}

          <AdminListFooter meta={result.meta} basePath={BASE_PATH} searchParams={resolved} itemLabel="کد تخفیف" />
        </div>
      )}
    </div>
  );
}