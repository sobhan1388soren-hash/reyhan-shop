"use server";

// Authentication server actions — phone + OTP flow.
// All state transitions happen server-side; the client never sees codes.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizePhone, validateOptionalEmail, validateOptionalName } from "@/lib/auth/phone";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroySession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/dal";
import type { AuthFormState, ProfileFormState } from "@/lib/auth/form-state";

function safeNextPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow internal paths to prevent open-redirect.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/account";
}

// ── Login: request + verify ───────────────────────────────────────────

export async function requestLoginOtp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const phoneCheck = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phoneCheck.ok) {
    return { step: "phone", error: phoneCheck.error };
  }
  const phone = phoneCheck.phone;

  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    // Use a single generic message to prevent user enumeration.
    if (!user || user.status !== "ACTIVE") {
      return {
        step: "phone",
        error: "اطلاعات واردشده صحیح نیست. لطفاً دوباره تلاش کنید.",
      };
    }

    const result = await requestOtp(phone, "LOGIN", user.id);
    if (!result.ok) {
      return {
        step: "phone",
        phone,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    }
    return {
      step: "otp",
      phone,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  } catch {
    return {
      step: "phone",
      phone,
      error: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    };
  }
}

export async function verifyLoginOtp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  if (!/^989\d{9}$/.test(phone)) {
    return { step: "phone", error: "نشست شما منقضی شده است. دوباره وارد شوید." };
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return { step: "otp", phone, error: "کد ۶ رقمی پیامک‌شده را وارد کنید." };
  }

  try {
    const result = await verifyOtp(phone, "LOGIN", code);
    if (!result.ok) {
      return {
        step: "otp",
        phone,
        error: result.error,
        attemptsLeft: result.attemptsLeft,
      };
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    // Use a single generic message to prevent user enumeration.
    if (!user || user.status !== "ACTIVE") {
      return { step: "phone", error: "اطلاعات واردشده صحیح نیست. لطفاً دوباره تلاش کنید." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });

    await createSession(user.id, user.role);
  } catch {
    return {
      step: "otp",
      phone,
      error: "خطایی در تأیید کد رخ داد. دوباره تلاش کنید.",
    };
  }

  redirect(nextPath);
}

// ── Registration: request + verify ───────────────────────────────────

export async function requestRegisterOtp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const fieldErrors: Record<string, string> = {};

  const firstNameRaw = String(formData.get("firstName") ?? "").trim();
  const firstNameCheck = validateOptionalName(firstNameRaw);
  if (!firstNameRaw) fieldErrors.firstName = "نام را وارد کنید.";
  else if (!firstNameCheck.ok) fieldErrors.firstName = firstNameCheck.error;

  const lastNameCheck = validateOptionalName(String(formData.get("lastName") ?? ""));
  if (!lastNameCheck.ok) fieldErrors.lastName = lastNameCheck.error;

  const emailCheck = validateOptionalEmail(String(formData.get("email") ?? ""));
  if (!emailCheck.ok) fieldErrors.email = emailCheck.error;

  const phoneCheck = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phoneCheck.ok) {
    return { step: "phone", fieldErrors: { ...fieldErrors, phone: phoneCheck.error } };
  }
  const phone = phoneCheck.phone;

  try {
    const existing = await prisma.user.findUnique({ where: { phone } });
    // Use a generic message to prevent user enumeration — whether the
    // number is already registered or something else went wrong, the caller
    // gets the same response so they cannot discover registered accounts.
    if (existing) {
      return {
        step: "phone",
        fieldErrors: { phone: "ثبت‌نام با این شماره ممکن نیست. لطفاً با پشتیبانی تماس بگیرید." },
      };
    }

    // Persist registration intent so the verify step can create the account.
    const { requestId } = await storeRegisterIntent({
      firstName: firstNameRaw,
      lastName: lastNameCheck.ok ? lastNameCheck.value : "",
      email: emailCheck.ok && emailCheck.value ? emailCheck.value : undefined,
      phone,
    });

    const result = await requestOtp(phone, "VERIFY_PHONE", null);
    if (!result.ok) {
      return {
        step: "phone",
        fieldErrors: { phone: result.error },
        retryAfterSeconds: result.retryAfterSeconds,
      };
    }
    return {
      step: "otp",
      phone,
      message: "کد تأیید به شماره شما پیامک شد.",
      retryAfterSeconds: result.retryAfterSeconds,
      fieldErrors: { requestId },
    };
  } catch {
    return {
      step: "phone",
      error: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    };
  }
}

// Registration intent storage — server-side, keyed by a random request id.
// Avoids passing registration data through the client form or cookies.
const registerIntents = new Map<string, RegisterIntent>();

type RegisterIntent = {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  createdAt: number;
};

async function storeRegisterIntent(intent: Omit<RegisterIntent, "createdAt">): Promise<{
  requestId: string;
}> {
  const { randomUUID } = await import("node:crypto");
  const requestId = randomUUID();
  const now = Date.now();
  registerIntents.set(requestId, { ...intent, createdAt: now });
  // Expire intents after 10 minutes.
  for (const [key, value] of registerIntents) {
    if (now - value.createdAt > 10 * 60 * 1000) registerIntents.delete(key);
  }
  // Bound the store so unauthenticated callers cannot grow server memory
  // without limit by spamming registration requests. Oldest first.
  const MAX_REGISTER_INTENTS = 500;
  if (registerIntents.size > MAX_REGISTER_INTENTS) {
    const oldestFirst = [...registerIntents.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    );
    for (const [key] of oldestFirst.slice(0, registerIntents.size - MAX_REGISTER_INTENTS)) {
      registerIntents.delete(key);
    }
  }
  return { requestId };
}

export async function verifyRegisterOtp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
  // The requestId is submitted as a hidden form field and only ever validated
  // server-side against the intent store — the client cannot forge another
  // user's data. It must come from the form, not from _prev, because the
  // verify action's previous state never carries it.
  const requestId = String(formData.get("requestId") ?? "");

  if (!/^989\d{9}$/.test(phone)) {
    return { step: "phone", error: "نشست شما منقضی شده است. دوباره ثبت‌نام کنید." };
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return { step: "otp", phone, error: "کد ۶ رقمی پیامک‌شده را وارد کنید." };
  }

  try {
    const result = await verifyOtp(phone, "VERIFY_PHONE", code);
    if (!result.ok) {
      return {
        step: "otp",
        phone,
        error: result.error,
        attemptsLeft: result.attemptsLeft,
      };
    }

    const intent = requestId ? registerIntents.get(requestId) : undefined;
    if (!requestId || !intent || intent.phone !== phone) {
      return {
        step: "phone",
        error: "اطلاعات ثبت‌نام شما منقضی شده است. دوباره ثبت‌نام کنید.",
      };
    }
    registerIntents.delete(requestId);

    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerified: true,
        firstName: intent.firstName || null,
        lastName: intent.lastName || null,
        email: intent.email ?? null,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });

    await createSession(user.id, user.role);
  } catch {
    return {
      step: "otp",
      phone,
      error: "خطایی در تکمیل ثبت‌نام رخ داد. دوباره تلاش کنید.",
    };
  }

  redirect("/account");
}

// ── Logout ────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

// ── Profile update ───────────────────────────────────────────────────

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "برای ویرایش پروفایل، ابتدا وارد شوید." };

  const fieldErrors: Record<string, string> = {};
  const firstNameCheck = validateOptionalName(String(formData.get("firstName") ?? ""));
  if (!firstNameCheck.ok) fieldErrors.firstName = firstNameCheck.error;
  const lastNameCheck = validateOptionalName(String(formData.get("lastName") ?? ""));
  if (!lastNameCheck.ok) fieldErrors.lastName = lastNameCheck.error;
  const displayNameCheck = validateOptionalName(String(formData.get("displayName") ?? ""));
  if (!displayNameCheck.ok) fieldErrors.displayName = displayNameCheck.error;
  const emailCheck = validateOptionalEmail(String(formData.get("email") ?? ""));
  if (!emailCheck.ok) fieldErrors.email = emailCheck.error;

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const data = {
    firstName: firstNameCheck.ok && firstNameCheck.value ? firstNameCheck.value : null,
    lastName: lastNameCheck.ok && lastNameCheck.value ? lastNameCheck.value : null,
    displayName: displayNameCheck.ok && displayNameCheck.value ? displayNameCheck.value : null,
    email: emailCheck.ok && emailCheck.value ? emailCheck.value : null,
  };

  try {
    await prisma.user.update({ where: { id: user.id }, data });
    revalidatePath("/account/profile");
    revalidatePath("/account");
    return { message: "اطلاعات پروفایل با موفقیت ذخیره شد." };
  } catch {
    // Unique-constraint violation on email surfaces here.
    return { error: "ذخیره اطلاعات ممکن نشد. ایمیل واردشده قبلاً استفاده شده است." };
  }
}
