"use server";

// Product Q&A moderation server actions — Phase 14, Part 2. Delegates to
// the existing reviews service; authorization is re-checked server-side.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import { answerProductQuestion, moderateProductQuestion } from "@/lib/reviews/service";
import {
  evaluateQuestionAnswer,
  evaluateQuestionModeration,
  moderationAdminMessage,
} from "@/lib/admin/moderation-admin-rules";

export type QuestionAdminActionState = {
  message?: string;
  error?: string;
  fieldErrors?: { answer?: string };
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function answerQuestionAction(
  _prev: QuestionAdminActionState,
  formData: FormData
): Promise<QuestionAdminActionState> {
  const actor = await requireAdminForAction();
  const questionId = str(formData, "questionId");
  if (!questionId) return { error: moderationAdminMessage("VALIDATION") };

  const evaluation = evaluateQuestionAnswer(actor.role);
  if (!evaluation.ok) return { error: moderationAdminMessage(evaluation.code) };

  let result;
  try {
    result = await answerProductQuestion(actor.id, actor.role, questionId, {
      answer: str(formData, "answer"),
    });
  } catch {
    return { error: moderationAdminMessage("DB_ERROR") };
  }

  if (!result.ok) {
    if (result.code === "INVALID_INPUT") {
      return { error: moderationAdminMessage("VALIDATION"), fieldErrors: result.errors };
    }
    return { error: moderationAdminMessage(result.code) };
  }

  revalidatePath("/admin/questions");
  revalidatePath("/products");
  return { message: "پاسخ ثبت و پرسش منتشر شد." };
}

export async function moderateQuestionAction(
  _prev: QuestionAdminActionState,
  formData: FormData
): Promise<QuestionAdminActionState> {
  const actor = await requireAdminForAction();
  const questionId = str(formData, "questionId");
  const to = str(formData, "status") as "PENDING" | "ANSWERED" | "CLOSED";
  if (!questionId) return { error: moderationAdminMessage("VALIDATION") };

  const evaluation = evaluateQuestionModeration(actor.role, to);
  if (!evaluation.ok) return { error: moderationAdminMessage(evaluation.code) };

  let result;
  try {
    result = await moderateProductQuestion(actor.id, actor.role, questionId, to);
  } catch {
    return { error: moderationAdminMessage("DB_ERROR") };
  }
  if (!result.ok) return { error: moderationAdminMessage(result.code) };

  revalidatePath("/admin/questions");
  revalidatePath("/products");
  return {
    message: to === "CLOSED" ? "پرسش بسته شد و از نمایش عمومی حذف گردید." : "وضعیت پرسش به‌روزرسانی شد.",
  };
}