-- Email/password authentication.
--
-- Adds credentials for accounts that are not phone-based, which is why
-- `phone` becomes nullable. Purely additive apart from the NOT NULL drop:
-- no existing row is read, rewritten or deleted, and every existing `phone`
-- value is preserved. Safe to apply to a database that already holds data.
--
-- Verified against `prisma migrate diff` so applying this does not introduce
-- schema drift.
--
-- NOTE: `prisma migrate diff` also reports an unrelated pre-existing
-- difference — `wishlists.title SET DEFAULT 'لیست علاقه‌مندی‌ها'`. That is
-- deliberately NOT included here: the `wishlists` table does not exist in the
-- init migration at all (a separate, pre-existing gap). Fixing it belongs in
-- its own migration.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nationalCode" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
-- NULLs remain distinct in Postgres, so accounts without a national code are
-- unaffected by this unique index.
CREATE UNIQUE INDEX "users_nationalCode_key" ON "users"("nationalCode");