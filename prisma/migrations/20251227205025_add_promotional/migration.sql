-- CreateEnum
CREATE TYPE "public"."PromotionType" AS ENUM ('CODE', 'GIFT');

-- CreateEnum
CREATE TYPE "public"."PromotionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PromotionDiscountType" AS ENUM ('PERCENT', 'AMOUNT', 'PRODUCT_100');

-- CreateEnum
CREATE TYPE "public"."PromotionTargetType" AS ENUM ('SITE_WIDE', 'CATEGORIES', 'PRODUCTS');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "promotionCode" TEXT,
ADD COLUMN     "promotionId" TEXT;

-- CreateTable
CREATE TABLE "public"."Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."PromotionType" NOT NULL DEFAULT 'CODE',
    "status" "public"."PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "lockedToUserId" TEXT,
    "lockedToEmail" TEXT,
    "maxUsesTotal" INTEGER,
    "maxUsesPerUser" INTEGER,
    "discountType" "public"."PromotionDiscountType" NOT NULL,
    "percentOff" INTEGER,
    "amountOffPence" INTEGER,
    "applyShippingDiscount" BOOLEAN NOT NULL DEFAULT false,
    "shippingPercentOffDry" INTEGER,
    "shippingPercentOffFrozen" INTEGER,
    "targetType" "public"."PromotionTargetType" NOT NULL DEFAULT 'SITE_WIDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromotionCategory" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PromotionCategory_pkey" PRIMARY KEY ("promotionId","categoryId")
);

-- CreateTable
CREATE TABLE "public"."PromotionProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "public"."PromotionRedemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "emailUsed" TEXT,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "shippingDiscountPence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "public"."Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_status_startsAt_endsAt_idx" ON "public"."Promotion"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_lockedToUserId_idx" ON "public"."Promotion"("lockedToUserId");

-- CreateIndex
CREATE INDEX "Promotion_lockedToEmail_idx" ON "public"."Promotion"("lockedToEmail");

-- CreateIndex
CREATE INDEX "PromotionCategory_categoryId_idx" ON "public"."PromotionCategory"("categoryId");

-- CreateIndex
CREATE INDEX "PromotionProduct_productId_idx" ON "public"."PromotionProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_orderId_key" ON "public"."PromotionRedemption"("orderId");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotionId_createdAt_idx" ON "public"."PromotionRedemption"("promotionId", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionRedemption_userId_createdAt_idx" ON "public"."PromotionRedemption"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionRedemption_emailUsed_createdAt_idx" ON "public"."PromotionRedemption"("emailUsed", "createdAt");

-- CreateIndex
CREATE INDEX "Order_promotionId_createdAt_idx" ON "public"."Order"("promotionId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_promotionCode_idx" ON "public"."Order"("promotionCode");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Promotion" ADD CONSTRAINT "Promotion_lockedToUserId_fkey" FOREIGN KEY ("lockedToUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionCategory" ADD CONSTRAINT "PromotionCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionCategory" ADD CONSTRAINT "PromotionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
