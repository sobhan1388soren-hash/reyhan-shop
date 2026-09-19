"use server";

// Banner administration server actions — Phase 16.
//
// Authorization: every action resolves the actor via the existing Phase 13
// admin DAL (requireAdminForAction → DATABASE user row, deny-by-default)
// and passes it to the banner service, which re-checks the ADMIN/STAFF
// allow-list. Placement/URL/link values are validated by the pure banner
// rules before any write. The homepage is revalidated on every mutation.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminForAction } from "@/lib/admin/dal";
import {
  createBanner,
  updateBanner,
  setBannerActive,
  deleteBanner,
} from "@/lib/marketing/banner-service";
import { BANNER_ERROR_MESSAGES } from "@/lib/marketing/banner-rules";
import type { BannerErrorCode } from "@/lib/marketing/banner-rules";

export type BannerActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(
  error: BannerErrorCode,
  fieldErrors?: Record<string, string>
): BannerActionState {
  return { error: BANNER_ERROR_MESSAGES[error], fieldErrors };
}

function revalidateMarketing(): void {
  revalidatePath("/admin/banners");
  // Banner content feeds the public homepage.
  revalidatePath("/");
}

function readInput(formData: FormData) {
  return {
    placement: str(formData, "placement"),
    title: str(formData, "title"),
    description: str(formData, "description"),
    imageUrl: str(formData, "imageUrl"),
    primaryLinkHref: str(formData, "primaryLinkHref"),
    primaryLinkLabel: str(formData, "primaryLinkLabel"),
    secondaryLinkHref: str(formData, "secondaryLinkHref"),
    secondaryLinkLabel: str(formData, "secondaryLinkLabel"),
    isActive: str(formData, "isActive"),
    sortOrder: str(formData, "sortOrder"),
  };
}

export async function createBannerAction(
  _prev: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  const actor = await requireAdminForAction();
  const result = await createBanner(actor, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateMarketing();
  redirect(`/admin/banners/${result.data.id}?created=1`);
}

export async function updateBannerAction(
  _prev: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  const actor = await requireAdminForAction();
  const bannerId = str(formData, "bannerId");
  if (!bannerId) return failure("VALIDATION");
  const result = await updateBanner(actor, bannerId, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateMarketing();
  return { message: "بنر به‌روزرسانی شد." };
}

export async function setBannerActiveAction(
  _prev: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  const actor = await requireAdminForAction();
  const bannerId = str(formData, "bannerId");
  if (!bannerId) return failure("VALIDATION");
  const result = await setBannerActive(actor, bannerId, str(formData, "isActive") === "true");
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateMarketing();
  return {
    message: result.data.isActive
      ? "بنر فعال شد."
      : "بنر غیرفعال شد.",
  };
}

export async function deleteBannerAction(
  _prev: BannerActionState,
  formData: FormData
): Promise<BannerActionState> {
  const actor = await requireAdminForAction();
  const bannerId = str(formData, "bannerId");
  if (!bannerId) return failure("VALIDATION");
  const result = await deleteBanner(actor, bannerId);
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateMarketing();
  return { message: "بنر حذف شد." };
}
