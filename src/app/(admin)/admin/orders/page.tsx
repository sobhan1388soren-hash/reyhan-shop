import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import {
  parseAdminListPage,
  parseAdminSearchTerm,
  parseEnumFilter,
  firstParam,
  type AdminListSearchParams,
} from "@/lib/admin/list";
import {
  getAdminOrders,
  type AdminOrderListFilters,
  type AdminOrderRow,
} from "@/lib/admin/queries";
import { orderStatusLabels, paymentStatusLabels } from "@/lib/auth/labels";
import { orderStatusTones, paymentStatusTones } from "@/lib/admin/labels";
import {
  ADMIN_STATUS_OPTIONS,
  ADMIN_PAYMENT_STATUS_OPTIONS,
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
  title: "سفارش‌ها",
};

const BASE_PATH = "/admin/orders";

const columns: AdminColumn<AdminOrderRow>[] = [
  {
    key: "orderNumber",
    header: "شماره سفارش",
    cell: (row) => (
      <Link
        href={`${BASE_PATH}/${row.id}`}
        className="font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
        dir="ltr"
      >
        {row.orderNumber}
      </Link>
    ),
  },
  {
    key: "customer",
    header: "مشتری",
    cell: (row) =>
      row.customer ? (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.customer.name}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground" dir="ltr">
            {row.customer.phone}
          </p>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          {row.recipientName ?? "—"}
          <span className="block text-[11px]">سفارش مهمان</span>
        </span>
      ),
  },
  {
    key: "date",
    header: "تاریخ ثبت",
    secondary: true,
    cell: (row) => <span className="text-xs text-muted-foreground">{formatFaDate(row.createdAt)}</span>,
  },
  {
    key: "items",
    header: "اقلام",
    secondary: true,
    className: "text-center",
    cell: (row) => <span className="tabular-nums text-muted-foreground">{toFaDigits(row.itemCount)}</span>,
  },
  {
    key: "total",
    header: "مبلغ کل",
    cell: (row) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatPriceToman(row.totalAmount)}</span>,
  },
  {
    key: "payment",
    header: "پرداخت",
    cell: (row) => <AdminStatusBadge tone={paymentStatusTones[row.paymentStatus]}>{paymentStatusLabels[row.paymentStatus]}</AdminStatusBadge>,
  },
  {
    key: "status",
    header: "وضعیت سفارش",
    cell: (row) => <AdminStatusBadge tone={orderStatusTones[row.status]}>{orderStatusLabels[row.status]}</AdminStatusBadge>,
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
          aria-label={`مشاهده جزئیات سفارش ${row.orderNumber}`}
        >
          جزئیات
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<AdminListSearchParams>;
}) {
  await requireAdmin();
  const resolved = await searchParams;

  const pagination = parseAdminListPage(resolved);
  const q = parseAdminSearchTerm(firstParam(resolved.q));
  const status = parseEnumFilter(firstParam(resolved.status), ADMIN_STATUS_OPTIONS.map((o) => o.value));
  const paymentStatus = parseEnumFilter(
    firstParam(resolved.payment),
    ADMIN_PAYMENT_STATUS_OPTIONS.map((o) => o.value)
  );

  const filters: AdminOrderListFilters = { ...pagination, q, status, paymentStatus };
  const result = await getAdminOrders(filters);

  return (
    <div>
      <AdminPageHeader title="سفارش‌ها" description="مشاهده و پیگیری سفارش‌های ثبت‌شده فروشگاه." />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <AdminListToolbar
            search={<AdminSearchField label="جستجوی سفارش" placeholder="شماره سفارش، مشتری، شماره تماس…" initValue={q ?? ""} />}
            filters={
              <>
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت سفارش"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_STATUS_OPTIONS}
                  value={status ?? ""}
                />
                <AdminSelectFilter
                  name="payment"
                  label="فیلتر وضعیت پرداخت"
                  allLabel="همه پرداخت‌ها"
                  options={ADMIN_PAYMENT_STATUS_OPTIONS}
                  value={paymentStatus ?? ""}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="سفارشی یافت نشد"
                description={
                  q || status || paymentStatus
                    ? "هیچ سفارشی با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز سفارشی در فروشگاه ثبت نشده است."
                }
              />
            </div>
          ) : (
            <>
              <AdminTable caption="فهرست سفارش‌ها" columns={columns} rows={result.rows} keyOf={(r) => r.id} />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست سفارش‌ها"
                renderCard={(row) => (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`${BASE_PATH}/${row.id}`}
                          className="text-sm font-semibold text-foreground hover:underline"
                          dir="ltr"
                        >
                          {row.orderNumber}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.customer ? row.customer.name : row.recipientName ?? "سفارش مهمان"}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-bold tabular-nums">
                        {formatPriceToman(row.totalAmount)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge tone={orderStatusTones[row.status]}>{orderStatusLabels[row.status]}</AdminStatusBadge>
                        <AdminStatusBadge tone={paymentStatusTones[row.paymentStatus]}>
                          {paymentStatusLabels[row.paymentStatus]}
                        </AdminStatusBadge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{formatFaDate(row.createdAt)}</span>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          <AdminListFooter
            meta={result.meta}
            basePath={BASE_PATH}
            searchParams={resolved}
            itemLabel="سفارش"
          />
        </div>
      )}
    </div>
  );
}
