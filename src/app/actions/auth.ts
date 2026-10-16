"use server";

// Authentication server actions — phone + OTP flow + email/password.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { normalizePhone, validateOptionalEmail, validateOptionalName } from "@/lib/auth/phone";
import {
  EMAIL_ERROR_MESSAGES,
  EMAIL_NOT_FOUND_ERROR,
  GENERIC_CREDENTIALS_ERROR,
  WRONG_PASSWORD_ERROR,
  validateEmail,
  validateEmailLogin,
  validateEmailRegister,
} from "@/lib/auth/email-rules";
import { consumeAuthRateLimit } from "@/lib/auth/rate-limit.ts";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroySession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getEmailSender } from "@/lib/auth/email";
import type { AuthFormState, ProfileFormState, EmailLoginFormState, EmailRegisterFormState } from "@/lib/auth/form-state";

function safeNextPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow internal paths to prevent open-redirect.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/account";
}

/**
 * Like safeNextPath but returns null when the caller supplied no destination.
 * The auth modal omits `next` so it can close itself and refresh in place
 * instead of navigating the user away from the current page.
 */
function optionalNextPath(raw: FormDataEntryValue | null): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
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
      purpose: "VERIFY_PHONE",
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

// Durable registration intent storage — Prisma-backed to survive serverless
// cold starts. All phone-OTP registrations and email registrations flow
// through here to avoid passing PII through the client form or cookies.

const REGISTER_INTENT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REGISTER_INTENTS = 500;

async function storeRegisterIntent(intent: {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  passwordHash?: string;
  nationalCode?: string;
  purpose: string;
}): Promise<{ requestId: string }> {
  const requestId = randomUUID();
  const expiresAt = new Date(Date.now() + REGISTER_INTENT_TTL_MS);

  await prisma.registerIntent.create({
    data: {
      requestId,
      firstName: intent.firstName,
      lastName: intent.lastName,
      email: intent.email ?? null,
      phone: intent.phone,
      passwordHash: intent.passwordHash ?? null,
      nationalCode: intent.nationalCode ?? null,
      purpose: intent.purpose,
      expiresAt,
    },
  });

  // Cleanup expired intents (best-effort, not atomic with insert).
  try {
    await prisma.registerIntent.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Ignore cleanup errors — they'll be cleaned up on next request.
  }

  // Bound the table so unauthenticated callers cannot grow DB storage
  // without limit by spamming registration requests.
  const count = await prisma.registerIntent.count();
  if (count > MAX_REGISTER_INTENTS) {
    const oldest = await prisma.registerIntent.findMany({
      orderBy: { createdAt: "asc" },
      take: count - MAX_REGISTER_INTENTS,
      select: { id: true },
    });
    await prisma.registerIntent.deleteMany({
      where: { id: { in: oldest.map((r) => r.id) } },
    });
  }

  return { requestId };
}

async function getRegisterIntent(requestId: string, phone: string): Promise<{
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  passwordHash?: string;
  nationalCode?: string;
} | null> {
  const intent = await prisma.registerIntent.findUnique({
    where: { requestId },
  });
  if (!intent) return null;
  if (intent.phone !== phone) return null;
  if (intent.expiresAt.getTime() < Date.now()) {
    await prisma.registerIntent.delete({ where: { id: intent.id } }).catch(() => {});
    return null;
  }
  return {
    firstName: intent.firstName ?? "",
    lastName: intent.lastName ?? "",
    email: intent.email ?? undefined,
    phone: intent.phone,
    passwordHash: intent.passwordHash ?? undefined,
    nationalCode: intent.nationalCode ?? undefined,
  };
}

async function consumeRegisterIntent(requestId: string): Promise<void> {
  await prisma.registerIntent.delete({ where: { requestId } }).catch(() => {});
}

export async function verifyRegisterOtp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
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

    const intent = await getRegisterIntent(requestId, phone);
    if (!intent) {
      return {
        step: "phone",
        error: "اطلاعات ثبت‌نام شما منقضی شده است. دوباره ثبت‌نام کنید.",
      };
    }
    await consumeRegisterIntent(requestId);

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

// ── Email/Password Login ──────────────────────────────────────────

export async function loginWithEmail(
  _prev: EmailLoginFormState,
  formData: FormData
): Promise<EmailLoginFormState> {
  const check = validateEmailLogin({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!check.ok) return { step: "email", fieldErrors: check.fieldErrors };

  // Brute-force guard: without this, passwords could be guessed online
  // without restriction. Checked before the DB lookup so limited requests
  // short-circuit without touching the database.
  if (!consumeAuthRateLimit(`login:${check.data.email}`, EMAIL_LOGIN_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_MS)) {
    return { step: "email", error: AUTH_RATE_LIMIT_MESSAGE };
  }

  const nextPath = optionalNextPath(formData.get("next"));

  try {
    const user = await prisma.user.findUnique({ where: { email: check.data.email } });

    // Specific rejection messages so users can tell "wrong email" apart from
    // "wrong password". Note: unlike the phone/OTP flow, this endpoint can
    // therefore reveal whether an email is registered — an explicit product
    // decision favoring user-friendly errors over anti-enumeration here.
    if (!user) {
      return { step: "email", error: EMAIL_NOT_FOUND_ERROR };
    }
    if (user.status !== "ACTIVE") {
      return { step: "email", error: GENERIC_CREDENTIALS_ERROR };
    }
    if (!user.passwordHash) {
      // Phone-OTP account with no password set — a password attempt can
      // never succeed, so report it as a wrong password.
      return { step: "email", error: WRONG_PASSWORD_ERROR };
    }

    if (!user.emailVerified) {
      return {
        step: "email",
        error: "ایمیل شما تأیید نشده است. لطفاً ابتدا ایمیل تأیید را بررسی کنید.",
      };
    }

    const valid = verifyPassword(check.data.password, user.passwordHash);
    if (!valid) {
      return { step: "email", error: WRONG_PASSWORD_ERROR };
    }

    await createSession(user.id, user.role);
  } catch {
    return { step: "email", error: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
  }

  // No `next` (the auth modal) → stay on the page, close in place, refresh.
  if (nextPath) redirect(nextPath);
  return { step: "email", success: true, message: "با موفقیت وارد حساب خود شدید." };
}

// ── Email/Password Registration ───────────────────────────────────

const EMAIL_VERIFY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const AUTH_RATE_LIMIT_MESSAGE = "تعداد تلاش‌های شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.";
const EMAIL_LOGIN_RATE_LIMIT = 10; // attempts per email per 10 minutes
const EMAIL_REGISTER_RATE_LIMIT = 5; // attempts per email per 10 minutes
const EMAIL_RESEND_RATE_LIMIT = 5; // attempts per email per 10 minutes
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// Resolved lazily per call (not at module load) so the deployed value is
// always honored, including on long-lived server instances.
function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "") || "http://localhost:3000";
}

async function sendVerificationEmail(
  email: string,
  verifyToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const verifyUrl = `${getSiteUrl()}/verify-email?token=${verifyToken}`;
  const emailHtml = `
      <h1> تأیید ایمیل </h1>
      <p> برای تأیید آدرس ایمیل خود، روی پیوند زیر کلیک کنید: </p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>این پیوند تا یک ساعت معتبر است.</p>
    `;
  return getEmailSender().sendEmail({
    to: email,
    subject: "تأیید ایمیل - فروشگاه ریحان",
    html: emailHtml,
  });
}

export async function registerWithEmail(
  _prev: EmailRegisterFormState,
  formData: FormData
): Promise<EmailRegisterFormState> {
  const check = validateEmailRegister({
    email: formData.get("email"),
    password: formData.get("password"),
    nationalCode: formData.get("nationalCode"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!check.ok) return { step: "email", fieldErrors: check.fieldErrors };

  const { email, password, nationalCode, firstName, lastName } = check.data;

  // Registration reveals taken emails/national codes by design (user-friendly
  // errors, mirroring the login endpoint's explicit product decision). The
  // rate limit keeps that from becoming a bulk-harvesting oracle.
  if (!consumeAuthRateLimit(`register:${email}`, EMAIL_REGISTER_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_MS)) {
    return { step: "email", error: AUTH_RATE_LIMIT_MESSAGE };
  }

  try {
    const [existingEmail, existingNationalCode] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { nationalCode }, select: { id: true } }),
    ]);

    const fieldErrors: Record<string, string> = {};
    if (existingEmail) fieldErrors.email = EMAIL_ERROR_MESSAGES.emailTaken;
    if (existingNationalCode) {
      fieldErrors.nationalCode = EMAIL_ERROR_MESSAGES.nationalCodeTaken;
    }
    if (Object.keys(fieldErrors).length > 0) return { step: "email", fieldErrors };

    const passwordHash = hashPassword(password);
    const verifyToken = randomUUID();
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        nationalCode,
        firstName,
        lastName,
        phone: null,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: false,
        emailVerificationToken: verifyToken,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MS),
      },
    });

    const delivery = await sendVerificationEmail(email, verifyToken);
    if (!delivery.ok) {
      // The account exists and can be verified later via the resend path —
      // but claiming "email sent" would be a lie (notably in production,
      // where the console sender fails closed). Surface the honest state.
      return {
        step: "email_pending",
        success: true,
        message:
          "حساب شما ایجاد شد اما ارسال ایمیل تأیید ممکن نشد. لطفاً از صفحه تأیید ایمیل، درخواست پیوند جدید بدهید.",
      };
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return {
        step: "email",
        fieldErrors: { email: EMAIL_ERROR_MESSAGES.emailTaken },
      };
    }
    return { step: "email", error: "خطایی در ثبت‌نام رخ داد. لطفاً دوباره تلاش کنید." };
  }

  return {
    step: "email_pending",
    success: true,
    message: "ایمیل تأیید به آدرس شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.",
  };
}

export type VerifyEmailResult = {
  error?: string;
  success?: boolean;
  /** True when the link expired — the UI should offer the resend path. */
  expired?: boolean;
  /** The address a fresh link can be issued for (only with `expired`). */
  email?: string;
};

export async function verifyEmail(
  _prev: unknown,
  formData: FormData
): Promise<VerifyEmailResult> {
  const token = String(formData.get("token") ?? "");

  if (!token || token.length < 10) {
    return { error: "پیوند تأیید نامعتبر است." };
  }

  try {
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return { error: "پیوند تأیید نامعتبر یا منقضی شده است." };
    }

    if (user.emailVerified) {
      return { error: "این ایمیل قبلاً تأیید شده است." };
    }

    // Links are valid for EMAIL_VERIFY_TOKEN_TTL_MS after issue. Rows
    // created before the expiry column existed carry NULL and are treated
    // as expired — the resend action below issues a fresh link.
    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      await prisma.user
        .update({
          where: { id: user.id },
          data: { emailVerificationToken: null, emailVerificationExpires: null },
        })
        .catch(() => {});
      return {
        error: "پیوند تأیید منقضی شده است. می‌توانید پیوند جدید دریافت کنید.",
        expired: true,
        email: user.email ?? undefined,
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { success: true };
  } catch {
    return { error: "خطایی در تأیید ایمیل رخ داد. لطفاً دوباره تلاش کنید." };
  }
}

export type ResendVerificationResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

/**
 * Issue a fresh verification link for an unverified email address. This is
 * the only recovery path for expired links and for registrations whose
 * original send failed — without it those accounts could never verify.
 */
export async function resendVerificationEmail(
  _prev: unknown,
  formData: FormData
): Promise<ResendVerificationResult> {
  const emailCheck = validateEmail(String(formData.get("email") ?? ""));
  if (!emailCheck.ok) return { error: emailCheck.error };
  const email = emailCheck.value;

  if (!consumeAuthRateLimit(`resend:${email}`, EMAIL_RESEND_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_MS)) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Mirror the login endpoint's explicit product decision: specific
    // messages instead of anti-enumeration generics.
    if (!user) return { error: EMAIL_NOT_FOUND_ERROR };
    if (user.status !== "ACTIVE") return { error: GENERIC_CREDENTIALS_ERROR };
    if (user.emailVerified) return { error: "این ایمیل قبلاً تأیید شده است." };
    if (!user.passwordHash) return { error: WRONG_PASSWORD_ERROR };

    const verifyToken = randomUUID();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verifyToken,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MS),
      },
    });

    const delivery = await sendVerificationEmail(email, verifyToken);
    if (!delivery.ok) {
      return { error: "ارسال ایمیل تأیید ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید." };
    }
    return {
      success: true,
      message: "پیوند تأیید جدید به آدرس شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.",
    };
  } catch {
    return { error: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
  }
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
