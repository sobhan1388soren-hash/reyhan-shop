import Link from "next/link";
import {
  formatFaDate,
  toFaDigits,
} from "@/lib/catalog/format";
import type { ProductReviewsSummary } from "@/lib/catalog/product-detail";

// ── Stars ─────────────────────────────────────────────────────────────

export function StarRating({
  value,
  size = "md",
  showValue = false,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}) {
  const rounded = Math.round(value);
  const sizeClass = size === "sm" ? "size-3.5" : size === "lg" ? "size-6" : "size-4";
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={sizeClass} fill={i <= rounded ? "currentColor" : "none"}>
          <path
            d="M10 1.7l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8L10 1.7Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
      {showValue && (
        <span className="ms-1 text-xs font-medium tabular-nums text-muted-foreground">
          {toFaDigits(value.toFixed(1))}
        </span>
      )}
    </span>
  );
}

function RatingSummary({ summary }: { summary: ProductReviewsSummary }) {
  const { total, average, distribution } = summary;
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg bg-muted/40 px-6 py-4 text-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {average != null ? toFaDigits(average.toFixed(1)) : "—"}
        </span>
        {average != null ? (
          <StarRating value={average} size="sm" />
        ) : null}
        <span className="text-xs text-muted-foreground">
          از {toFaDigits(total)} دیدگاه
        </span>
      </div>
      <ul className="w-full space-y-1.5" aria-label="توزیع امتیازها">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star];
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-8 shrink-0 tabular-nums">{toFaDigits(star)} ★</span>
              <span
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-end tabular-nums">
                {toFaDigits(count)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Reviews section ───────────────────────────────────────────────────

export function ProductReviewsSection({
  summary,
}: {
  summary: ProductReviewsSummary;
}) {
  const { items, total } = summary;

  return (
    <section aria-labelledby="reviews-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="text-lg font-semibold text-foreground">
          دیدگاه کاربران
        </h2>
        <span className="text-xs text-muted-foreground">
          {total > 0
            ? `${toFaDigits(total)} دیدگاه ثبت‌شده`
            : "هنوز دیدگاهی ثبت نشده است"}
        </span>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            هنوز دیدگاهی برای این محصول ثبت نشده است
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            اگر این محصول را خریداری کرده‌اید، تجربه خود را با سایر کاربران به اشتراک بگذارید.
          </p>
        </div>
      ) : (
        <>
          <RatingSummary summary={summary} />

          <ul className="space-y-4">
            {items.map((review) => (
              <li key={review.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {review.authorName.trim().charAt(0) || "؟"}
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {review.authorName}
                        {review.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--reyhan-green-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--reyhan-green-700)]">
                            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
                              <path d="M3.5 8.5L6.5 11.5L12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            خرید تاییدشده
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatFaDate(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StarRating value={review.rating} size="sm" />
                </div>
                {review.title && (
                  <p className="mt-3 text-sm font-semibold text-foreground">{review.title}</p>
                )}
                {review.comment && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Q&A section ───────────────────────────────────────────────────────

export function ProductQnaSection({
  questions,
}: {
  questions: import("@/lib/catalog/product-detail").ProductQuestionView[];
}) {
  return (
    <section aria-labelledby="qna-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="qna-heading" className="text-lg font-semibold text-foreground">
          پرسش و پاسخ
        </h2>
        <span className="text-xs text-muted-foreground">
          {questions.length > 0
            ? `${toFaDigits(questions.length)} پرسش`
            : "هنوز پرسشی ثبت نشده است"}
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            هنوز پرسشی برای این محصول ثبت نشده است
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            اگر سؤالی درباره این محصول دارید، می‌توانید از طریق{" "}
            <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">
              صفحه تماس با ما
            </Link>{" "}
            بپرسید.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  ؟
                </span>
                <div>
                  <p className="text-sm font-medium leading-7 text-foreground">{q.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.authorName} — {formatFaDate(q.createdAt)}
                  </p>
                </div>
              </div>

              {q.answers.length > 0 ? (
                <ul className="mt-4 space-y-3 border-t pt-4">
                  {q.answers.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <span
                        className={
                          a.isStaff
                            ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
                            : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                        }
                      >
                        {a.isStaff ? "ریحان" : "پاسخ"}
                      </span>
                      <div>
                        <p className="text-sm leading-7 text-muted-foreground">{a.answer}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.isStaff ? "کارشناس ریحان" : a.authorName} — {formatFaDate(a.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  در انتظار پاسخ کارشناسان
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
