-- Email-verification columns + register_intents table.
--
-- The schema declared `User.emailVerified`, `User.emailVerificationToken`
-- and the `RegisterIntent` model before any migration created them, so the
-- generated client and the live database disagreed (P2022 ColumnNotFound at
-- runtime). This migration closes that gap. Purely additive: no existing row
-- is read, rewritten or deleted. `emailVerified` backfills to `false`, so
-- pre-existing accounts must complete email verification before email login.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerificationToken" TEXT;

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "users"("emailVerificationToken");

-- CreateTable
CREATE TABLE "register_intents" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "passwordHash" TEXT,
    "nationalCode" TEXT,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "register_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "register_intents_requestId_key" ON "register_intents"("requestId");
CREATE INDEX "register_intents_requestId_idx" ON "register_intents"("requestId");
CREATE INDEX "register_intents_email_purpose_idx" ON "register_intents"("email", "purpose");
CREATE INDEX "register_intents_phone_purpose_idx" ON "register_intents"("phone", "purpose");
CREATE INDEX "register_intents_expiresAt_idx" ON "register_intents"("expiresAt");
