// OTP service — secure one-time password issuance and verification.
// Security rules (Phase 7 baseline):
//   • expiry: 2 minutes      • max attempts: 5 per token
//   • resend cooldown: 60s   • single-use
//   • SHA-256 hashed storage (never plaintext)
//   • issuing a new OTP invalidates previous ones for that phone+purpose
//   • in-memory + DB-backed rate limiting for issuance and verification

import "server-only";
import { createHash, randomInt } from "node:crypto";
import prisma from "@/lib/prisma";
import type { OtpPurpose } from "@prisma/client";
import { getSmsOtpSender } from "./sms";
import {
  OTP_TTL_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_LENGTH,
} from "./constants";

const OTP_TTL_MS = OTP_TTL_SECONDS * 1000;
const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  // Per-phone salt prevents cross-user hash comparison tricks.
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

// ── Rate limiting (in-memory, per phone) ───────────────────────────────
// Protects the DB-less path from bursts; DB uniqueness adds durability.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Periodic cleanup to keep the map small in long-running processes.
const lastCleanup = { at: 0 };
function cleanupBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup.at < 60_000) return;
  lastCleanup.at = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

// ── Public result types ────────────────────────────────────────────────

export type RequestOtpResult =
  | { ok: true; expiresAt: Date; retryAfterSeconds: number }
  | { ok: false; error: string; retryAfterSeconds?: number };

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string; attemptsLeft?: number };

// ── Issue ──────────────────────────────────────────────────────────────

export async function requestOtp(
  phone: string,
  purpose: OtpPurpose,
  existingUserId: string | null
): Promise<RequestOtpResult> {
  cleanupBuckets();

  // Issuance rate limit: 5 requests per phone per 10 minutes.
  if (!rateLimit(`issue:${phone}`, 5, 10 * 60 * 1000)) {
    return {
      ok: false,
      error: "تعداد درخواست‌های شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
      retryAfterSeconds: 300,
    };
  }

  // Resend cooldown against the latest active token.
  const latest = await prisma.otpToken.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest) {
    const elapsed = Date.now() - latest.createdAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "برای درخواست مجدد کد، کمی صبر کنید.",
        retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  // Invalidate all previous tokens for this phone+purpose.
  await prisma.otpToken.updateMany({
    where: { phone, purpose, verified: false },
    data: { verified: true }, // verified=true marks consumed/invalidated
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpToken.create({
    data: {
      phone,
      code: hashCode(phone, code),
      purpose,
      expiresAt,
      attempts: 0,
      verified: false,
      userId: existingUserId,
    },
  });

  const delivery = await getSmsOtpSender().sendOtp(phone, code);
  if (!delivery.ok) {
    // Delivery failed — consume the token so it cannot be verified blind.
    await prisma.otpToken.updateMany({
      where: { phone, purpose, verified: false },
      data: { verified: true },
    });
    return {
      ok: false,
      error: "ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
    };
  }

  return { ok: true, expiresAt, retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

// ── Verify ────────────────────────────────────────────────────────────

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  code: string
): Promise<VerifyOtpResult> {
  // Brute-force limit: 10 verification attempts per phone per 5 minutes.
  if (!rateLimit(`verify:${phone}`, 10, 5 * 60 * 1000)) {
    return {
      ok: false,
      error: "تلاش‌های تأیید بیش از حد مجاز است. چند دقیقه بعد دوباره امتحان کنید.",
    };
  }

  const token = await prisma.otpToken.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!token || token.verified) {
    return { ok: false, error: "کد واردشده معتبر نیست. دوباره کد دریافت کنید." };
  }
  if (token.expiresAt.getTime() <= Date.now()) {
    // Expired — consume it.
    await prisma.otpToken.update({ where: { id: token.id }, data: { verified: true } });
    return { ok: false, error: "مدت اعتبار کد به پایان رسیده است. کد جدید دریافت کنید." };
  }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpToken.update({ where: { id: token.id }, data: { verified: true } });
    return { ok: false, error: "تعداد تلاش‌های ناموفق بیش از حد مجاز بود. کد جدید دریافت کنید." };
  }

  const matches = token.code === hashCode(phone, code.trim());
  if (!matches) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - token.attempts - 1;
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    if (attemptsLeft <= 0) {
      return {
        ok: false,
        error: "تعداد تلاش‌های ناموفق بیش از حد مجاز بود. کد جدید دریافت کنید.",
      };
    }
    return {
      ok: false,
      error: "کد واردشده نادرست است.",
      attemptsLeft,
    };
  }

  // Single-use: mark consumed.
  await prisma.otpToken.update({ where: { id: token.id }, data: { verified: true } });
  return { ok: true };
}
