-- CreateEnum
CREATE TYPE "public"."OfferMode" AS ENUM ('AUTO', 'CODE', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."OfferStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."OfferStackingMode" AS ENUM ('BEST_DISCOUNT_WINS', 'HIGHEST_PRIORITY_WINS', 'STACK_ALLOWED');

-- CreateEnum
CREATE TYPE "public"."OfferVisibility" AS ENUM ('ALL', 'BADGE_ONLY', 'PRODUCT_PAGE', 'CART_ONLY');

-- CreateTable
CREATE TABLE "public"."Offer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "public"."OfferMode" NOT NULL DEFAULT 'AUTO',
    "code" TEXT,
    "status" "public"."OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "stackingMode" "public"."OfferStackingMode" NOT NULL DEFAULT 'BEST_DISCOUNT_WINS',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountPerOrderPence" INTEGER,
    "preventFreeOrder" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "public"."OfferVisibility" NOT NULL DEFAULT 'ALL',
    "exclusions" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_code_key" ON "public"."Offer"("code");

-- CreateIndex
CREATE INDEX "Offer_status_startsAt_endsAt_idx" ON "public"."Offer"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Offer_stackingMode_priority_idx" ON "public"."Offer"("stackingMode", "priority");

-- CreateIndex
CREATE INDEX "Offer_createdAt_idx" ON "public"."Offer"("createdAt");
