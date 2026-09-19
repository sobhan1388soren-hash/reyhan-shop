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
import { getAdminUsers, type AdminUserRow } from "@/lib/admin/queries";
import { userStatusLabels, userRoleLabels, userStatusTones } from "@/lib/admin/labels";
import { ADMIN_USER_ROLE_OPTIONS, ADMIN_USER_STATUS_OPTIONS } from "@/lib/admin/options";
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
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "کاربران",
};

const BASE_PATH = "/admin/users";

const columns: AdminColumn<AdminUserRow>[] = [
  {
    key: "name",
    header: "کاربر",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
        >
          {row.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <Link
            href={`${BASE_PATH}/${row.id}`}
            className="block truncate font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
          >
            {row.name}
          </Link>
          <p className="truncate text-xs tabular-nums text-muted-foreground" dir="ltr">
            {row.phone}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "ایمیل",
    secondary: true,
    cell: (row) => (
      <span className="text-xs text-muted-foreground" dir="ltr">
        {row.email ?? "—"}
      </span>
    ),
  },
  {
    key: "role",
    header: "نقش",
    cell: (row) => (
      <span className="text-xs font-medium text-foreground">
        {userRoleLabels[row.role] ?? row.role}
      </span>
    ),
  },
  {
    key: "status",
    header: "وضعیت",
    cell: (row) => (
      <AdminStatusBadge tone={userStatusTones[row.status] ?? "neutral"}>
        {userStatusLabels[row.status] ?? row.status}
      </AdminStatusBadge>
    ),
  },
  {
    key: "orders",
    header: "سفارش‌ها",
    secondary: true,
    className: "text-center",
    cell: (row) => <span className="tabular-nums text-muted-foreground">{toFaDigits(row.orderCount)}</span>,
  },
  {
    key: "createdAt",
    header: "تاریخ عضویت",
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
          aria-label={`مشاهده جزئیات کاربر ${row.name}`}
        >
          جزئیات
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminListSearchParams>;
}) {
  await requireAdmin();
  const resolved = await searchParams;

  const pagination = parseAdminListPage(resolved);
  const q = parseAdminSearchTerm(firstParam(resolved.q));
  const role = parseEnumFilter(firstParam(resolved.role), ADMIN_USER_ROLE_OPTIONS.map((o) => o.value));
  const status = parseEnumFilter(firstParam(resolved.status), ADMIN_USER_STATUS_OPTIONS.map((o) => o.value));

  const result = await getAdminUsers({ ...pagination, q, role, status });

  return (
    <div>
      <AdminPageHeader title="کاربران" description="مشاهده حساب‌های کاربری فروشگاه. در این فاز، دسترسی به کاربران فقط مشاهده است." />

      {result.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <AdminListToolbar
            search={<AdminSearchField label="جستجوی کاربر" placeholder="نام، شماره موبایل، ایمیل…" initValue={q ?? ""} />}
            filters={
              <>
                <AdminSelectFilter
                  name="role"
                  label="فیلتر نقش"
                  allLabel="همه نقش‌ها"
                  options={ADMIN_USER_ROLE_OPTIONS}
                  value={role ?? ""}
                />
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت حساب"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_USER_STATUS_OPTIONS}
                  value={status ?? ""}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="کاربری یافت نشد"
                description={
                  q || role || status
                    ? "هیچ کاربری با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز کاربری در فروشگاه ثبت‌نام نکرده است."
                }
              />
            </div>
          ) : (
            <>
              <AdminTable caption="فهرست کاربران" columns={columns} rows={result.rows} keyOf={(r) => r.id} />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست کاربران"
                renderCard={(row) => (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                      >
                        {row.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`${BASE_PATH}/${row.id}`}
                          className="block truncate text-sm font-semibold text-foreground hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="truncate text-xs tabular-nums text-muted-foreground" dir="ltr">
                          {row.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <AdminStatusBadge tone={userStatusTones[row.status] ?? "neutral"}>
                        {userStatusLabels[row.status] ?? row.status}
                      </AdminStatusBadge>
                      <span className="text-[11px] text-muted-foreground">
                        {userRoleLabels[row.role] ?? row.role}
                      </span>
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
            itemLabel="کاربر"
          />
        </div>
      )}
    </div>
  );
}
