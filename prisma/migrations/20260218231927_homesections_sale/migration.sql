-- CreateEnum
CREATE TYPE "public"."HomeSectionType" AS ENUM ('PRODUCT_CAROUSEL');

-- CreateEnum
CREATE TYPE "public"."HomeSectionProductSource" AS ENUM ('BEST_SELLERS', 'LEAST_SOLD', 'MOST_CLICKED', 'LEAST_CLICKED', 'NEW_ARRIVALS', 'DEALS', 'COLLECTION', 'CATEGORY', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."HomeSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "type" "public"."HomeSectionType" NOT NULL DEFAULT 'PRODUCT_CAROUSEL',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeSection_enabled_position_idx" ON "public"."HomeSection"("enabled", "position");

-- CreateIndex
CREATE INDEX "HomeSection_startAt_endAt_idx" ON "public"."HomeSection"("startAt", "endAt");
