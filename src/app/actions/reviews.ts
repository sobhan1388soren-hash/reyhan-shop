"use server";

// Reviews & Q&A server actions — thin, secure transport between the
// product-page UI and the reviews domain service. Every action
// re-derives the user (and role) from the signed session; client input
// carries only *wishes* (rating, text, product id). Verified-purchaser
// status and authorization are always computed server-side.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  submitReview,
  askProductQuestion,
} from "@/lib/reviews/service";
import type {
  ReviewFormState,
  QuestionFormState,
} from "@/lib/reviews/form-state";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function ratingOf(formData: FormData): number {
  const raw = str(formData, "rating").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function revalidateProduct(productSlug: string): void {
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

// ── Review submission ──────────────────────────────────────────────────

export async function submitProductReview(
  _prev: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "idle",
      error: "برای ثبت دیدگاه، ابتدا وارد حساب کاربری خود شوید.",
    };
  }

  const productId = str(formData, "productId");
  const productSlug = str(formData, "productSlug");

  let result;
  try {
    result = await submitReview(user.id, productId, {
      rating: ratingOf(formData),
      title: str(formData, "title"),
      comment: str(formData, "comment"),
    });
  } catch {
    return {
      status: "idle",
      error: "ثبت دیدگاه در حال حاضر ممکن نشد. لطفاً دوباره تلاش کنید.",
    };
  }

  if (result.ok) {
    revalidateProduct(productSlug);
    return {
      status: "submitted",
      message:
        "دیدگاه شما ثبت شد و پس از بررسی کارشناسان منتشر خواهد شد. از همراهی شما سپاسگزاریم.",
    };
  }

  switch (result.code) {
    case "INVALID_INPUT":
      return { status: "idle", fieldErrors: result.errors };
    case "PRODUCT_NOT_FOUND":
      return { status: "idle", error: "محصول مورد نظر یافت نشد." };
    case "NOT_VERIFIED_PURCHASER":
      return {
        status: "idle",
        error:
          "ثبت دیدگاه فقط برای خریداران این محصول امکان‌پذیر است. اگر این محصول را خریداری کرده‌اید، پس از تأیید پرداخت سفارش می‌توانید دیدگاه ثبت کنید.",
      };
    case "ALREADY_REVIEWED":
      return {
        status: "idle",
        error: "شما پیش‌تر برای این محصول دیدگاه ثبت کرده‌اید.",
      };
    case "UNAUTHENTICATED":
      return {
        status: "idle",
        error: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.",
      };
    default:
      return {
        status: "idle",
        error: "ثبت دیدگاه در حال حاضر ممکن نشد. لطفاً دوباره تلاش کنید.",
      };
  }
}

// ── Question submission ───────────────────────────────────────────────

export async function askProductQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "idle",
      error: "برای پرسیدن سؤال، ابتدا وارد حساب کاربری خود شوید.",
    };
  }

  const productId = str(formData, "productId");
  const productSlug = str(formData, "productSlug");

  let result;
  try {
    result = await askProductQuestion(user.id, productId, {
      question: str(formData, "question"),
    });
  } catch {
    return {
      status: "idle",
      error: "ثبت پرسش در حال حاضر ممکن نشد. لطفاً دوباره تلاش کنید.",
    };
  }

  if (result.ok) {
    revalidateProduct(productSlug);
    return {
      status: "submitted",
      message:
        "پرسش شما ثبت شد و پس از بررسی و پاسخ کارشناسان، در صفحه محصول منتشر می‌شود.",
    };
  }

  switch (result.code) {
    case "INVALID_INPUT":
      return { status: "idle", fieldErrors: result.errors };
    case "PRODUCT_NOT_FOUND":
      return { status: "idle", error: "محصول مورد نظر یافت نشد." };
    case "UNAUTHENTICATED":
      return {
        status: "idle",
        error: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.",
      };
    default:
      return {
        status: "idle",
        error: "ثبت پرسش در حال حاضر ممکن نشد. لطفاً دوباره تلاش کنید.",
      };
  }
}
