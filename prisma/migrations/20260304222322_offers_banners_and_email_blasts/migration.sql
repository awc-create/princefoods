/*
  Warnings:

  - The `scope` column on the `OfferEmailBlast` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `updatedAt` on the `OfferEmailBlastRecipient` table. All the data in the column will be lost.
  - The `status` column on the `OfferEmailBlastRecipient` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."OfferEmailScope" AS ENUM ('ALL_CUSTOMERS', 'SELECTED_USERS');

-- CreateEnum
CREATE TYPE "public"."OfferBlastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- DropIndex
DROP INDEX "public"."OfferEmailBlastRecipient_email_idx";

-- DropIndex
DROP INDEX "public"."OfferEmailBlastRecipient_userId_idx";

-- AlterTable
ALTER TABLE "public"."OfferEmailBlast" ADD COLUMN     "userIds" JSONB,
DROP COLUMN "scope",
ADD COLUMN     "scope" "public"."OfferEmailScope" NOT NULL DEFAULT 'ALL_CUSTOMERS';

-- AlterTable
ALTER TABLE "public"."OfferEmailBlastRecipient" DROP COLUMN "updatedAt",
DROP COLUMN "status",
ADD COLUMN     "status" "public"."OfferBlastRecipientStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "public"."BlastScope";

-- CreateIndex
CREATE INDEX "Offer_emailEnabled_idx" ON "public"."Offer"("emailEnabled");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_blastId_status_idx" ON "public"."OfferEmailBlastRecipient"("blastId", "status");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_email_createdAt_idx" ON "public"."OfferEmailBlastRecipient"("email", "createdAt");

-- CreateIndex
CREATE INDEX "OfferEmailBlastRecipient_userId_createdAt_idx" ON "public"."OfferEmailBlastRecipient"("userId", "createdAt");
