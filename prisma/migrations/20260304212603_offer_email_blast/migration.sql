-- CreateEnum
CREATE TYPE "public"."BlastScope" AS ENUM ('ALL_CUSTOMERS', 'SELECTED_USERS');

-- CreateEnum
CREATE TYPE "public"."BlastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Offer" ADD COLUMN     "bannerCtaHref" TEXT,
ADD COLUMN     "bannerCtaLabel" TEXT,
ADD COLUMN     "bannerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannerEndsAt" TIMESTAMP(3),
ADD COLUMN     "bannerMessage" TEXT,
ADD COLUMN     "bannerStartsAt" TIMESTAMP(3),
ADD COLUMN     "bannerTitle" TEXT,
ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailMessage" TEXT,
ADD COLUMN     "emailSubject" TEXT;

-- CreateTable
CREATE TABLE "public"."OfferEmailBlast" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "scope" "public"."BlastScope" NOT NULL DEFAULT 'ALL_CUSTOMERS',
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferEmailBlast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OfferEmailBlastRecipient" (
    "id" TEXT NOT NULL,
    "blastId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" "public"."BlastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "resendId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferEmailBlastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferEmailBlast_offerId_createdAt_idx" ON "public"."OfferEmailBlast"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX "OfferEmailBlast_startedAt_finishedAt_idx" ON "public"."OfferEmailBlast"("startedAt", "finishedAt");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_blastId_status_idx" ON "public"."OfferEmailBlastRecipient"("blastId", "status");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_email_idx" ON "public"."OfferEmailBlastRecipient"("email");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_userId_idx" ON "public"."OfferEmailBlastRecipient"("userId");

-- CreateIndex
CREATE INDEX "Offer_bannerEnabled_bannerStartsAt_bannerEndsAt_idx" ON "public"."Offer"("bannerEnabled", "bannerStartsAt", "bannerEndsAt");

-- AddForeignKey
ALTER TABLE "public"."OfferEmailBlast" ADD CONSTRAINT "OfferEmailBlast_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OfferEmailBlastRecipient" ADD CONSTRAINT "OfferEmailBlastRecipient_blastId_fkey" FOREIGN KEY ("blastId") REFERENCES "public"."OfferEmailBlast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OfferEmailBlastRecipient" ADD CONSTRAINT "OfferEmailBlastRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
