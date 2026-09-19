"use server";

// Review moderation server actions — Phase 14, Part 2. Delegates to the
// existing reviews service; authorization is re-checked server-side.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import { moderateReview } from "@/lib/reviews/service";
import {
  evaluateReviewModeration,
  moderationAdminMessage,
} from "@/lib/admin/moderation-admin-rules";

export type ReviewModerationActionState = {
  message?: string;
  error?: string;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function moderateReviewAction(
  _prev: ReviewModerationActionState,
  formData: FormData
): Promise<ReviewModerationActionState> {
  const actor = await requireAdminForAction();
  const reviewId = str(formData, "reviewId");
  const to = str(formData, "status") as "PENDING" | "APPROVED" | "REJECTED";
  if (!reviewId) return { error: moderationAdminMessage("VALIDATION") };

  const evaluation = evaluateReviewModeration(actor.role, to);
  if (!evaluation.ok) return { error: moderationAdminMessage(evaluation.code) };

  let result;
  try {
    result = await moderateReview(actor.id, actor.role, reviewId, to);
  } catch {
    return { error: moderationAdminMessage("DB_ERROR") };
  }
  if (!result.ok) return { error: moderationAdminMessage(result.code) };

  revalidatePath("/admin/reviews");
  revalidatePath("/products");
  return {
    message:
      to === "APPROVED"
        ? "دیدگاه تأیید و در صفحه محصول منتشر شد."
        : to === "REJECTED"
          ? "دیدگاه رد شد."
          : "دیدگاه به حالت در انتظار بررسی بازگردانده شد.",
  };
}