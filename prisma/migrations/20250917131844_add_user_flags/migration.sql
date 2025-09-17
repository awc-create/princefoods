-- CreateEnum
CREATE TYPE "public"."UserAuditAction" AS ENUM ('CREATE', 'UPDATE', 'RESTRICT', 'ANONYMIZE', 'RESTORE', 'HARD_DELETE');

-- AlterTable
ALTER TABLE "public"."PasswordToken" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restrictedAt" TIMESTAMP(3),
ADD COLUMN     "restrictionNote" TEXT;

-- AlterTable
ALTER TABLE "public"."VerificationToken" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."UserAudit" (
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
CREATE INDEX "UserAudit_userId_createdAt_idx" ON "public"."UserAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "public"."User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_isAnonymized_idx" ON "public"."User"("isAnonymized");

-- AddForeignKey
ALTER TABLE "public"."UserAudit" ADD CONSTRAINT "UserAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
