/*
  Warnings:

  - A unique constraint covering the columns `[orderId,promotionId]` on the table `PromotionRedemption` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PromotionApplyMode" AS ENUM ('AUTO', 'CODE', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."PromotionStackPolicy" AS ENUM ('BEST_DISCOUNT_WINS', 'HIGHEST_PRIORITY_WINS', 'ALLOW_STACKING');

-- DropIndex
DROP INDEX "public"."PromotionRedemption_orderId_key";

-- AlterTable
ALTER TABLE "public"."Promotion" ADD COLUMN     "applyMode" "public"."PromotionApplyMode" NOT NULL DEFAULT 'CODE',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stackPolicy" "public"."PromotionStackPolicy" NOT NULL DEFAULT 'BEST_DISCOUNT_WINS',
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PromotionAttempt" ALTER COLUMN "code" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."OrderPromotion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "codeUsed" TEXT,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "shippingDiscountPence" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPromotion_promotionId_appliedAt_idx" ON "public"."OrderPromotion"("promotionId", "appliedAt");

-- CreateIndex
CREATE INDEX "OrderPromotion_orderId_appliedAt_idx" ON "public"."OrderPromotion"("orderId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPromotion_orderId_promotionId_key" ON "public"."OrderPromotion"("orderId", "promotionId");

-- CreateIndex
CREATE INDEX "Promotion_applyMode_status_idx" ON "public"."Promotion"("applyMode", "status");

-- CreateIndex
CREATE INDEX "Promotion_priority_idx" ON "public"."Promotion"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_orderId_promotionId_key" ON "public"."PromotionRedemption"("orderId", "promotionId");

-- AddForeignKey
ALTER TABLE "public"."OrderPromotion" ADD CONSTRAINT "OrderPromotion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderPromotion" ADD CONSTRAINT "OrderPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
