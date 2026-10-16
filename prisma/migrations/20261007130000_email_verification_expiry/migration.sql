-- Email-verification link expiry.
--
-- `registerWithEmail` issues a one-hour verification link, but nothing ever
-- expired it: a leaked link stayed redeemable indefinitely, and the
-- `EMAIL_VERIFY_TOKEN_TTL_MS` constant in the auth actions was dead code.
-- This adds the `emailVerificationExpires` timestamp the server now sets on
-- issue and enforces on verify. Purely additive: existing rows get NULL,
-- which the server treats as expired (the resend action issues a fresh
-- link), so no stale link is ever silently accepted.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3);
