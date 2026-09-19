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
  getAdminQuestions,
  getAdminQuestionCounts,
  type AdminQuestionRow,
} from "@/lib/admin/qa-admin-service";
import { questionStatusLabels, questionStatusTones } from "@/lib/admin/labels";
import { ADMIN_QUESTION_STATUS_OPTIONS } from "@/lib/admin/options";
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
import { QuestionAdminActions } from "@/components/admin/question-admin-actions";
import { formatFaDate, toFaDigits } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "پرسش‌ها و پاسخ‌ها",
};

const BASE_PATH = "/admin/questions";

function CountTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{toFaDigits(value)}</p>
    </div>
  );
}

function QuestionCard({ question }: { question: AdminQuestionRow }) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={questionStatusTones[question.status]}>
              {questionStatusLabels[question.status]}
            </AdminStatusBadge>
            {question.answerCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {toFaDigits(question.answerCount)} پاسخ
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-foreground">{question.question}</p>
          {question.product ? (
            <Link
              href={`/admin/products/${question.product.id}`}
              className="mt-1 block truncate text-xs text-muted-foreground hover:text-[var(--reyhan-blue-700)] hover:underline"
            >
              {question.product.title}
            </Link>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">محصول حذف‌شده</p>
          )}
        </div>
        <div className="text-end text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{question.asker?.name ?? "کاربر ریحان"}</p>
          {question.asker?.phone && (
            <p className="tabular-nums" dir="ltr">
              {question.asker.phone}
            </p>
          )}
          <p className="mt-0.5">{formatFaDate(question.createdAt)}</p>
        </div>
      </div>

      {question.answers.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="پاسخ‌های ثبت‌شده">
          {question.answers.map((answer) => (
            <li key={answer.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm leading-6">
              <p className="text-muted-foreground">{answer.answer}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {answer.authorName}
                {answer.isStaff ? " (کارشناس)" : ""} · {formatFaDate(answer.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t pt-4">
        <QuestionAdminActions
          questionId={question.id}
          status={question.status}
          answerCount={question.answerCount}
        />
      </div>
    </li>
  );
}

export default async function AdminQuestionsPage({
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
    ADMIN_QUESTION_STATUS_OPTIONS.map((o) => o.value)
  );

  const [result, counts] = await Promise.all([
    getAdminQuestions({ ...pagination, q, status }),
    getAdminQuestionCounts(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="پرسش‌ها و پاسخ‌ها"
        description="پاسخ به پرسش‌های مشتریان درباره محصولات و مدیریت وضعیت انتشار آن‌ها."
      />

      {result.state === "error" || counts.state === "error" ? (
        <AdminListErrorState />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <CountTile label="در انتظار پاسخ" value={counts.counts.PENDING} tone="text-amber-600" />
            <CountTile label="پاسخ داده‌شده" value={counts.counts.ANSWERED} tone="text-[var(--reyhan-green-700)]" />
            <CountTile label="بسته‌شده" value={counts.counts.CLOSED} tone="text-muted-foreground" />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <AdminListToolbar
              search={<AdminSearchField label="جستجوی پرسش" placeholder="متن پرسش، محصول یا کاربر..." initValue={q ?? ""} />}
              filters={
                <AdminSelectFilter
                  name="status"
                  label="فیلتر وضعیت"
                  allLabel="همه وضعیت‌ها"
                  options={ADMIN_QUESTION_STATUS_OPTIONS}
                  value={status ?? ""}
                />
              }
            />

            {result.rows.length === 0 ? (
              <div className="p-6">
                <AdminEmptyState
                  title="پرسشی یافت نشد"
                  description={
                    q || status
                      ? "هیچ پرسشی با فیلترهای فعلی مطابقت ندارد. فیلترها را تغییر دهید."
                      : "هنوز پرسشی از سوی مشتریان ثبت نشده است."
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3 bg-muted/10 p-4" aria-label="فهرست پرسش‌ها">
                {result.rows.map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
              </ul>
            )}

            <AdminListFooter meta={result.meta} basePath={BASE_PATH} searchParams={resolved} itemLabel="پرسش" />
          </div>
        </div>
      )}
    </div>
  );
}