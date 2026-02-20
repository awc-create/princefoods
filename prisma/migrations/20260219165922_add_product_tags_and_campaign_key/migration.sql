-- CreateEnum
CREATE TYPE "public"."CampaignKey" AS ENUM ('ONAM', 'VISHU', 'DIWALI', 'PONGAL', 'RAMADAN_EID', 'EASTER', 'CHRISTMAS', 'NEW_YEAR', 'SUMMER_BBQ', 'BACK_TO_UNI', 'CUSTOM');

-- AlterEnum
ALTER TYPE "public"."HomeSectionProductSource" ADD VALUE 'CAMPAIGN';

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Promotion" ADD COLUMN     "campaignKey" "public"."CampaignKey" DEFAULT 'CUSTOM';

-- CreateIndex
CREATE INDEX "Product_tags_idx" ON "public"."Product" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Promotion_campaignKey_idx" ON "public"."Promotion"("campaignKey");
