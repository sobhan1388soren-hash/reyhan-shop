// In-memory brute-force guard for the email/password auth endpoints.
// Server-only: state lives in module scope and must never be imported by
// client code.
//
// The phone/OTP flow already rate-limits issuance and verification in
// ./otp.ts; the email login/register/resend endpoints had no limit at all,
// so passwords could be guessed online without restriction. This closes that
// gap with the same per-key bucket approach.
//
// Limitation (shared with ./otp.ts): buckets are per server instance, so on
// multi-instance serverless deployments this is a best-effort friction
// layer, not a hard global cap. The DB-backed uniqueness checks remain the
// durable protection against duplicate accounts.

import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Consume one attempt from the bucket for `key`. Returns true when the
 * attempt is allowed, false when the caller must reject with a
 * rate-limit message.
 */
export function consumeAuthRateLimit(key: string, limit: number, windowMs: number): boolean {
  cleanup();
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
