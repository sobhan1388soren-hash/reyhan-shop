"use server";

// Discount administration server actions — Phase 14, Part 2.
//
// Business logic is the existing discount service; this layer only
// authorizes (Phase 13 DAL), maps form fields, and revalidates.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminForAction } from "@/lib/admin/dal";
import {
  createDiscountAdmin,
  updateDiscountAdmin,
  setDiscountActiveAdmin,
} from "@/lib/admin/discount-admin-service";
import { DISCOUNT_ADMIN_MESSAGES } from "@/lib/admin/discount-admin-rules";
import type { DiscountAdminErrorCode } from "@/lib/admin/discount-admin-rules";

export type DiscountActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(
  error: DiscountAdminErrorCode,
  fieldErrors?: Record<string, string>
): DiscountActionState {
  return { error: DISCOUNT_ADMIN_MESSAGES[error], fieldErrors };
}

function revalidateDiscounts(): void {
  revalidatePath("/admin/discounts");
  // Discounts affect the public checkout experience.
  revalidatePath("/checkout");
}

function readInput(formData: FormData) {
  return {
    code: str(formData, "code"),
    type: str(formData, "type"),
    value: str(formData, "value"),
    minOrderAmount: str(formData, "minOrderAmount"),
    maxDiscountAmount: str(formData, "maxDiscountAmount"),
    maxUses: str(formData, "maxUses"),
    maxUsesPerUser: str(formData, "maxUsesPerUser"),
    startsAt: str(formData, "startsAt"),
    endsAt: str(formData, "endsAt"),
    isActive: str(formData, "isActive"),
  };
}

export async function createDiscountAction(
  _prev: DiscountActionState,
  formData: FormData
): Promise<DiscountActionState> {
  const actor = await requireAdminForAction();
  const result = await createDiscountAdmin(actor, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateDiscounts();
  redirect(`/admin/discounts/${result.data.id}?created=1`);
}

export async function updateDiscountAction(
  _prev: DiscountActionState,
  formData: FormData
): Promise<DiscountActionState> {
  const actor = await requireAdminForAction();
  const discountId = str(formData, "discountId");
  if (!discountId) return failure("VALIDATION");
  const result = await updateDiscountAdmin(actor, discountId, readInput(formData));
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateDiscounts();
  return { message: "کد تخفیف به‌روزرسانی شد." };
}

export async function setDiscountActiveAction(
  _prev: DiscountActionState,
  formData: FormData
): Promise<DiscountActionState> {
  const actor = await requireAdminForAction();
  const discountId = str(formData, "discountId");
  if (!discountId) return failure("VALIDATION");
  const result = await setDiscountActiveAdmin(actor, discountId, str(formData, "isActive") === "true");
  if (!result.ok) return failure(result.error, result.fieldErrors);
  revalidateDiscounts();
  return {
    message: result.data.isActive
      ? "کد تخفیف فعال شد."
      : "کد تخفیف غیرفعال شد.",
  };
}