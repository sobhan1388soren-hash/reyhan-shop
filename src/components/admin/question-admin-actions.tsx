"use client";

import { useActionState } from "react";
import {
  answerQuestionAction,
  moderateQuestionAction,
  type QuestionAdminActionState,
} from "@/app/actions/question-moderation";
import { AdminFormFeedback, AdminSubmitButton, adminTextareaClass } from "@/components/admin/admin-form";
import type { QuestionStatus } from "@prisma/client";

// QuestionAdminActions — staff answer + close/reopen. The underlying Q&A
// flows and authorization are the existing reviews service.

export function QuestionAdminActions({
  questionId,
  status,
  answerCount,
}: {
  questionId: string;
  status: QuestionStatus;
  answerCount: number;
}) {
  const [answerState, answerAction, answerPending] = useActionState<
    QuestionAdminActionState,
    FormData
  >(answerQuestionAction, {});
  const [modState, modAction, modPending] = useActionState<QuestionAdminActionState, FormData>(
    moderateQuestionAction,
    {}
  );

  const reopenTarget = answerCount > 0 ? "ANSWERED" : "PENDING";

  return (
    <div className="space-y-3">
      {status !== "CLOSED" && (
        <form action={answerAction} className="space-y-2">
          <input type="hidden" name="questionId" value={questionId} />
          <label htmlFor={`answer-${questionId}`} className="block text-xs font-medium text-muted-foreground">
            پاسخ کارشناس
          </label>
          <textarea
            id={`answer-${questionId}`}
            name="answer"
            rows={2}
            className={adminTextareaClass}
            placeholder="پاسخ خود را بنویسید..."
            required
          />
          {answerState.fieldErrors?.answer && (
            <p className="text-xs text-destructive" role="alert">
              {answerState.fieldErrors.answer}
            </p>
          )}
          <AdminSubmitButton pending={answerPending}>
            {answerPending ? "در حال ثبت..." : "ثبت پاسخ"}
          </AdminSubmitButton>
          <AdminFormFeedback message={answerState.message} error={answerState.error} />
        </form>
      )}

      <form action={modAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="questionId" value={questionId} />
        {status !== "CLOSED" ? (
          <button
            type="submit"
            name="status"
            value="CLOSED"
            disabled={modPending}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            بستن پرسش
          </button>
        ) : (
          <button
            type="submit"
            name="status"
            value={reopenTarget}
            disabled={modPending}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            بازگشایی
          </button>
        )}
        <AdminFormFeedback message={modState.message} error={modState.error} />
      </form>
    </div>
  );
}