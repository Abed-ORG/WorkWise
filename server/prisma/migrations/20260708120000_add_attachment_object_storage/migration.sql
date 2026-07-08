-- Additive only — supports the Supabase Storage migration for new attachments.
-- Authored but NOT applied — see DB CHANGES STACK. Do NOT run `prisma migrate dev`
-- or `db push` against the shared DB with this file present until it has been
-- reviewed and applied deliberately (e.g. via `prisma migrate deploy`).
--
-- 1. "data" is relaxed from NOT NULL to nullable. This does not touch any existing
--    row's value — every current attachment keeps its base64 "data" populated and
--    keeps working unchanged. Only new object-storage attachments will insert
--    "data" = NULL going forward.
-- 2. "objectKey" / "storageBucket" are new nullable columns. NULL means "legacy
--    base64 row" (unchanged); non-NULL means "content lives in Supabase Storage".

-- AlterTable
ALTER TABLE "attachments" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "attachments" ADD COLUMN "objectKey" TEXT;
ALTER TABLE "attachments" ADD COLUMN "storageBucket" TEXT;
