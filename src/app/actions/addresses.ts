"use server";

// Address management server actions — user-scoped CRUD.
// Authorization: every query filters by the session user's id, derived
// server-side from the signed session cookie (never client-supplied).

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { validateAddressInput } from "@/lib/auth/phone";
import type { AddressFormState } from "@/lib/auth/form-state";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateAccount(): void {
  revalidatePath("/account/addresses");
  revalidatePath("/account");
}

// ── Create ────────────────────────────────────────────────────────────

export async function createAddress(
  _prev: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "برای مدیریت نشانی‌ها، ابتدا وارد شوید." };

  const validation = validateAddressInput({
    recipientName: str(formData, "recipientName"),
    phone: str(formData, "phone"),
    province: str(formData, "province"),
    city: str(formData, "city"),
    postalCode: str(formData, "postalCode"),
    addressLine: str(formData, "addressLine"),
  });
  if (!validation.ok) return { fieldErrors: validation.errors };

  try {
    const count = await prisma.address.count({ where: { userId: user.id } });
    const address = await prisma.address.create({
      data: {
        ...validation.data,
        postalCode: validation.data.postalCode ?? null,
        userId: user.id,
        // First address becomes the default automatically.
        isDefault: count === 0,
        sortOrder: count,
      },
    });
    revalidateAccount();
    return { message: `نشانی «${address.recipientName}» ذخیره شد.` };
  } catch {
    return { error: "ذخیره نشانی ممکن نشد. دوباره تلاش کنید." };
  }
}

// ── Update ────────────────────────────────────────────────────────────

export async function updateAddress(
  _prev: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "برای مدیریت نشانی‌ها، ابتدا وارد شوید." };

  const addressId = str(formData, "addressId");
  if (!addressId) return { error: "نشانی مشخص نیست." };

  const validation = validateAddressInput({
    recipientName: str(formData, "recipientName"),
    phone: str(formData, "phone"),
    province: str(formData, "province"),
    city: str(formData, "city"),
    postalCode: str(formData, "postalCode"),
    addressLine: str(formData, "addressLine"),
  });
  if (!validation.ok) return { fieldErrors: validation.errors };

  try {
    // Authorization: address must belong to the session user.
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    });
    if (!existing) return { error: "نشانی یافت نشد." };

    await prisma.address.update({
      where: { id: addressId },
      data: {
        ...validation.data,
        postalCode: validation.data.postalCode ?? null,
      },
    });
    revalidateAccount();
    return { message: "نشانی با موفقیت به‌روزرسانی شد." };
  } catch {
    return { error: "به‌روزرسانی نشانی ممکن نشد. دوباره تلاش کنید." };
  }
}

// ── Delete ────────────────────────────────────────────────────────────

export async function deleteAddress(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const addressId = str(formData, "addressId");
  if (!addressId) return;

  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) return;

  await prisma.address.delete({ where: { id: addressId } });
  // If the deleted one was the default, promote the first remaining.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  revalidateAccount();
}

// ── Set default ───────────────────────────────────────────────────────

export async function setDefaultAddress(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const addressId = str(formData, "addressId");
  if (!addressId) return;

  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) return;

  await prisma.address.updateMany({
    where: { userId: user.id },
    data: { isDefault: false },
  });
  await prisma.address.update({ where: { id: addressId }, data: { isDefault: true } });
  revalidateAccount();
}
