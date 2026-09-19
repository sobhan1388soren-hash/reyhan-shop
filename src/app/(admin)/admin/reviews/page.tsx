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
  getAdminReviews,
  getAdminReviewCounts,
  type AdminReviewRow,
} from "@/lib/admin/review-admin-service";
import { reviewStatusLabels, reviewStatusTones } from "@/lib/admin/labels";
import { ADMIN_REVIEW_STATUS_OPTIONS } from "@/lib/admin/options";
import {
  AdminListToolbar,
  AdminListFooter,
  AdminListErrorState,
} from "@/components/admin/admin-list";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminSearchField } from "@/components/admin/admin-search-field";
import { AdminSelectFilter } from "@/components/admin/admin-select-filter";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ReviewModerationActions } from "@/components/admin/review-moderation-actions";
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "نقد و بررسی‌ها",
};

const BASE_PATH = "/admin/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${toFaDigits(rating)} از ۵ ستاره`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={n <= rating ? "size-4 text-amber-500" : "size-4 text-border"}
          fill="currentColor"
        >
          <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8Z" />
        </svg>
      ))}
    </span>
  );
}

function CountTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{toFaDigits(value)}</p>
    </div>
  );
}

function ReviewCard({ review }: { review: AdminReviewRow }) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <AdminStatusBadge tone={reviewStatusTones[review.status]}>
              {reviewStatusLabels[review.status]}
            </AdminStatusBadge>
          </div>
          {review.product ? (
            <Link
              href={`/admin/products/${review.product.id}`}
              className="mt-2 block truncate text-sm font-semibold text-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
            >
              {review.product.title}
            </Link>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">محصول حذف‌شده</p>
          )}
        </div>
        <div className="text-end text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{review.reviewer?.name ?? "کاربر ریحان"}</p>
          {review.reviewer?.phone && (
            <p className="tabular-nums" dir="ltr">
              {review.reviewer.phone}
            </p>
          )}
          <p className="mt-0.5">{formatFaDate(review.createdAt)}</p>
        </div>
      </div>

      {(review.title || review.comment) && (
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm leading-6 text-foreground">
          {review.title && <p className="font-semibold">{review.title}</p>}
          {review.comment && <p className={review.title ? "mt-1 text-muted-foreground" : "text-muted-foreground"}>{review.comment}</p>}
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        <ReviewModerationActions reviewId={review.id} status={review.status} />
      </div>
    </li>
  );
}

export default async function AdminReviewsPage({
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
    ADMIN_REVIEW_STATUS_OPTIONS.map((o) => o.value)
  );

  const [result, counts] = await Promise.all([
    getAdminReviews({ ...pagination, q, status }),
    getAdminReviewCounts(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="نقد و بررسی‌ها"
        description="بررسی، تأیید یا رد دیدگاه‌های ثبت‌شده مشتریان. فقط دیدگاه‌های تأییدشده در فروشگاه نمایش داده می‌شوند."
      />

      {result.state === "error" || counts.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <CountTile label="در انتظار بررسی" value={counts.counts.PENDING} tone="text-amber-600" />
            <CountTile label="تأییدشده" value={counts.counts.APPROVED} tone="text-[var(--reyhan-green-700)]" />
            <CountTile label="ردشده" value={counts.counts.REJECTED} tone="text-destructive" />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <AdminListToolbar
              search={<AdminSearchField label="جستجوی دیدگاه" placeholder="متن، محصول یا کاربر..." initValue={q ?? ""} />}
              filters={
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_REVIEW_STATUS_OPTIONS}
                  value={status ?? ""}
                />
              }
            />

            {result.rows.length === 0 ? (
              <div className="p-6">
                <AdminEmptyState
                  title="دیدگاهی یافت نشد"
                  description={
                    q || status
                      ? "هیچ دیدگاهی با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                      : "هنوز دیدگاهی برای بررسی ثبت نشده است."
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3 bg-muted/10 p-4" aria-label="فهرست دیدگاه‌ها">
                {result.rows.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </ul>
            )}

            <AdminListFooter meta={result.meta} basePath={BASE_PATH} searchParams={resolved} itemLabel="دیدگاه" />
          </div>
        </div>
      )}
    </div>
  );
}