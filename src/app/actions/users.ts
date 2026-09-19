"use server";

// Customer management server actions — Phase 14, Part 2.
//
// IMPORTANT: user management is ADMIN-only (existing USER_MANAGEMENT_ROLES).
// The guard is re-enforced in the service against the DB-resolved actor, so
// a forged client role can never bypass it. Sensitive authentication
// operations (passwords/OTP/sessions/deletion) are intentionally absent.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin/dal";
import { setUserStatus, setUserRole } from "@/lib/admin/user-service";
import { USER_ADMIN_MESSAGES } from "@/lib/admin/user-admin-rules";
import type { UserAdminErrorCode } from "@/lib/admin/user-admin-rules";

export type UserActionState = {
  message?: string;
  error?: string;
};

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(error: UserAdminErrorCode): UserActionState {
  return { error: USER_ADMIN_MESSAGES[error] };
}

function revalidateUser(userId: string): void {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function setUserStatusAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const actor = await requireAdminForAction();
  const userId = str(formData, "userId");
  if (!userId) return failure("INVALID");

  const result = await setUserStatus(actor, userId, str(formData, "status"));
  if (!result.ok) return failure(result.error);

  revalidateUser(userId);
  return {
    message:
      result.data.status === "BLOCKED"
        ? "حساب کاربر مسدود شد و امکان ورود ندارد."
        : "حساب کاربر فعال شد.",
  };
}

export async function setUserRoleAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const actor = await requireAdminForAction();
  const userId = str(formData, "userId");
  if (!userId) return failure("INVALID");

  const result = await setUserRole(actor, userId, str(formData, "role"));
  if (!result.ok) return failure(result.error);

  revalidateUser(userId);
  return { message: "نقش کاربر به‌روزرسانی شد." };
}