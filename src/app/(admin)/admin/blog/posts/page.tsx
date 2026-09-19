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
  getAdminPosts,
  POST_SORTS,
  POST_STATUSES,
  type AdminPostRow,
  type AdminPostListFilters,
} from "@/lib/blog/post-service";
import { getAdminPostCategoryTree } from "@/lib/blog/category-service";
import { postStatusLabels, postStatusTones } from "@/lib/admin/labels";
import { ADMIN_POST_STATUS_OPTIONS } from "@/lib/admin/options";
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
import type { PostSort } from "@/lib/blog/post-rules";

export const metadata: Metadata = {
  title: "مقالات",
};

const BASE_PATH = "/admin/blog/posts";

const POST_SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: "published_desc", label: "جدیدترین منتشر شده" },
  { value: "published_asc", label: "قدیمی‌ترین منتشر شده" },
  { value: "updated_desc", label: "آخرین به‌روزرسانی" },
  { value: "created_desc", label: "تاریخ ایجاد" },
  { value: "title_asc", label: "عنوان (الف → ی)" },
  { value: "title_desc", label: "عنوان (ی → الف)" },
];

const columns: AdminColumn<AdminPostRow>[] = [
  {
    key: "title",
    header: "مقاله",
    cell: (row) => (
      <Link
        href={`${BASE_PATH}/${row.id}`}
        className="font-semibold text-foreground transition-colors hover:text-[var(--reyhan-blue-700)] hover:underline"
      >
        {row.title}
      </Link>
    ),
  },
  {
    key: "categories",
    header: "دسته‌بندی",
    secondary: true,
    cell: (row) =>
      row.categories.length > 0 ? (
        <span className="text-xs text-muted-foreground">
          {row.categories.map((c) => c.name).join("، ")}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "products",
    header: "محصولات",
    secondary: true,
    className: "text-center",
    cell: (row) => (
      <span className="tabular-nums text-xs text-muted-foreground">
        {row.productCount > 0 ? toFaDigits(row.productCount) : "—"}
      </span>
    ),
  },
  {
    key: "author",
    header: "نویسنده",
    secondary: true,
    cell: (row) => (
      <span className="text-xs text-muted-foreground">{row.authorName ?? "—"}</span>
    ),
  },
  {
    key: "publishedAt",
    header: "انتشار",
    secondary: true,
    cell: (row) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {row.publishedAt ? formatFaDate(row.publishedAt) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "وضعیت",
    cell: (row) => (
      <AdminStatusBadge tone={postStatusTones[row.status]}>
        {postStatusLabels[row.status]}
      </AdminStatusBadge>
    ),
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
          aria-label={`مدیریت مقاله ${row.title}`}
        >
          مدیریت
        </Link>
      </AdminRowActions>
    ),
  },
];

export default async function AdminBlogPostsPage({
  searchParams,
}: {
  searchParams: Promise<AdminListSearchParams>;
}) {
  await requireAdmin();
  const resolved = await searchParams;

  const pagination = parseAdminListPage(resolved);
  const q = parseAdminSearchTerm(firstParam(resolved.q));
  const status = parseEnumFilter(firstParam(resolved.status), POST_STATUSES);
  const sort = parseSortOption<PostSort>(firstParam(resolved.sort), POST_SORTS, "published_desc");

  // Category filter options come from the admin tree (all statuses).
  const categoryTree = await getAdminPostCategoryTree();
  const categoryFilter = firstParam(resolved.category);
  const categoryId =
    categoryTree.state === "ok" && categoryFilter
      ? categoryTree.categories.find((c) => c.slug === categoryFilter)?.id
      : undefined;

  const filters: AdminPostListFilters = { ...pagination, q, status, categoryId, sort };
  const result = await getAdminPosts(filters);
  const categoryOptions =
    categoryTree.state === "ok"
      ? categoryTree.categories.map((c) => ({ value: c.slug, label: c.name }))
      : [];

  return (
    <div>
      <AdminPageHeader
        title="مقالات"
        description="مدیریت مقالات مرکز دانش ریحان: ساخت، ویرایش، انتشار و بایگانی."
        actions={
          <Link
            href={`${BASE_PATH}/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            مقاله جدید
          </Link>
        }
      />

      {result.state === "error" ? (
        <AdminListErrorState onRetryHref={BASE_PATH} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <AdminListToolbar
            search={
              <AdminSearchField
                label="جستجوی مقاله"
                placeholder="عنوان یا اسلاگ..."
                initValue={q ?? ""}
              />
            }
            filters={
              <>
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_POST_STATUS_OPTIONS}
                  value={status ?? ""}
                />
                {categoryOptions.length > 0 && (
                  <AdminSelectFilter
                    name="category"
                    label="فیلتر دسته‌بندی"
                    allLabel="همه دسته‌بندی‌ها"
                    options={categoryOptions}
                    value={categoryFilter ?? ""}
                  />
                )}
                <AdminSelectFilter
                  name="sort"
                  label="ترتیب نمایش"
                  allLabel="پیش‌فرض (جدیدترین)"
                  options={POST_SORT_OPTIONS}
                  value={sort === "published_desc" ? "" : sort}
                />
              </>
            }
          />

          {result.rows.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="مقاله‌ای یافت نشد"
                description={
                  q || status || categoryId
                    ? "هیچ مقاله‌ای با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                    : "هنوز مقاله‌ای نوشته نشده است. با «مقاله جدید» اولین مطلب مرکز دانش را بسازید."
                }
                action={
                  !q && !status && !categoryId ? (
                    <Link
                      href={`${BASE_PATH}/new`}
                      className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
                    >
                      نوشتن مقاله
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AdminTable
                caption="فهرست مقالات"
                columns={columns}
                rows={result.rows}
                keyOf={(r) => r.id}
              />
              <AdminCardList
                rows={result.rows}
                keyOf={(r) => r.id}
                label="فهرست مقالات"
                renderCard={(row) => (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`${BASE_PATH}/${row.id}`}
                        className="text-sm font-semibold text-foreground transition-colors hover:underline"
                      >
                        {row.title}
                      </Link>
                      <AdminStatusBadge tone={postStatusTones[row.status]}>
                        {postStatusLabels[row.status]}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                      {row.categories.length > 0
                        ? row.categories.map((c) => c.name).join("، ")
                        : "بدون دسته‌بندی"}
                      {" · "}
                      {row.publishedAt ? formatFaDate(row.publishedAt) : "منتشر نشده"}
                    </p>
                  </div>
                )}
              />
            </>
          )}

          <AdminListFooter
            meta={result.meta}
            basePath={BASE_PATH}
            searchParams={resolved}
            itemLabel="مقاله"
          />
        </div>
      )}
    </div>
  );
}
