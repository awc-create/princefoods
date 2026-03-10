-- CreateEnum
CREATE TYPE "public"."PromoEmailBlastScope" AS ENUM ('ALL_CUSTOMERS', 'SELECTED_USERS');

-- CreateEnum
CREATE TYPE "public"."PromoEmailRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."PromotionEmailBlast" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "createdById" TEXT,
    "scope" "public"."PromoEmailBlastScope" NOT NULL DEFAULT 'ALL_CUSTOMERS',
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "plannedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromotionEmailBlast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromotionEmailBlastRecipient" (
    "id" TEXT NOT NULL,
    "blastId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" "public"."PromoEmailRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "resendId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PromotionEmailBlastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionEmailBlast_promotionId_createdAt_idx" ON "public"."PromotionEmailBlast"("promotionId", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionEmailBlast_createdAt_idx" ON "public"."PromotionEmailBlast"("createdAt");

-- CreateIndex
CREATE INDEX "PromotionEmailBlastRecipient_email_idx" ON "public"."PromotionEmailBlastRecipient"("email");

-- CreateIndex
CREATE INDEX "PromotionEmailBlastRecipient_status_idx" ON "public"."PromotionEmailBlastRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionEmailBlastRecipient_blastId_email_key" ON "public"."PromotionEmailBlastRecipient"("blastId", "email");

-- AddForeignKey
ALTER TABLE "public"."PromotionEmailBlast" ADD CONSTRAINT "PromotionEmailBlast_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionEmailBlast" ADD CONSTRAINT "PromotionEmailBlast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionEmailBlastRecipient" ADD CONSTRAINT "PromotionEmailBlastRecipient_blastId_fkey" FOREIGN KEY ("blastId") REFERENCES "public"."PromotionEmailBlast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionEmailBlastRecipient" ADD CONSTRAINT "PromotionEmailBlastRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
