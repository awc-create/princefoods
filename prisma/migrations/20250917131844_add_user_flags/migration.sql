-- CreateEnum (safe: only create if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserAuditAction') THEN
    CREATE TYPE "public"."UserAuditAction" AS ENUM ('CREATE', 'UPDATE', 'RESTRICT', 'ANONYMIZE', 'RESTORE', 'HARD_DELETE');
  END IF;
END$$;

-- AlterTable PasswordToken
ALTER TABLE "public"."PasswordToken"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

-- AlterTable User
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "restrictedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "restrictionNote" TEXT;

-- AlterTable VerificationToken
ALTER TABLE "public"."VerificationToken"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable UserAudit
CREATE TABLE IF NOT EXISTS "public"."UserAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" "public"."UserAuditAction" NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserAudit_userId_createdAt_idx"
  ON "public"."UserAudit"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx"
  ON "public"."User"("deletedAt");

CREATE INDEX IF NOT EXISTS "User_isAnonymized_idx"
  ON "public"."User"("isAnonymized");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserAudit_userId_fkey'
      AND table_name = 'UserAudit'
  ) THEN
    ALTER TABLE "public"."UserAudit"
      ADD CONSTRAINT "UserAudit_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
