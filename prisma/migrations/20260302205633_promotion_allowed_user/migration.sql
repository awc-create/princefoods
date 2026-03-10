-- CreateEnum
CREATE TYPE "public"."PromotionCustomerScope" AS ENUM ('ALL', 'USERS');

-- AlterTable
ALTER TABLE "public"."Promotion" ADD COLUMN     "eligibleCustomerScope" "public"."PromotionCustomerScope" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "public"."PromotionAllowedUser" (
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PromotionAllowedUser_pkey" PRIMARY KEY ("promotionId","userId")
);

-- CreateIndex
CREATE INDEX "PromotionAllowedUser_userId_idx" ON "public"."PromotionAllowedUser"("userId");

-- CreateIndex
CREATE INDEX "Promotion_eligibleCustomerScope_idx" ON "public"."Promotion"("eligibleCustomerScope");

-- AddForeignKey
ALTER TABLE "public"."PromotionAllowedUser" ADD CONSTRAINT "PromotionAllowedUser_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionAllowedUser" ADD CONSTRAINT "PromotionAllowedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
