-- CreateEnum
CREATE TYPE "public"."ShippingTemp" AS ENUM ('DRY', 'FROZEN');

-- CreateEnum
CREATE TYPE "public"."ShippingService" AS ENUM ('STANDARD', 'EXPRESS');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "shippingTemp" "public"."ShippingTemp" NOT NULL DEFAULT 'DRY';

-- CreateTable
CREATE TABLE "public"."ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingZoneRule" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "postcodeRegex" TEXT,
    "postcodePrefix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingZoneRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "temp" "public"."ShippingTemp" NOT NULL,
    "service" "public"."ShippingService" NOT NULL DEFAULT 'STANDARD',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "freeOverPence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingRateTier" (
    "id" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "minGramsExclusive" INTEGER NOT NULL DEFAULT 0,
    "maxGramsInclusive" INTEGER,
    "pricePence" INTEGER NOT NULL,

    CONSTRAINT "ShippingRateTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingZone_isActive_priority_idx" ON "public"."ShippingZone"("isActive", "priority");

-- CreateIndex
CREATE INDEX "ShippingZoneRule_countryCode_idx" ON "public"."ShippingZoneRule"("countryCode");

-- CreateIndex
CREATE INDEX "ShippingZoneRule_zoneId_idx" ON "public"."ShippingZoneRule"("zoneId");

-- CreateIndex
CREATE INDEX "ShippingRate_temp_service_idx" ON "public"."ShippingRate"("temp", "service");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_zoneId_temp_service_key" ON "public"."ShippingRate"("zoneId", "temp", "service");

-- CreateIndex
CREATE INDEX "ShippingRateTier_rateId_minGramsExclusive_idx" ON "public"."ShippingRateTier"("rateId", "minGramsExclusive");

-- CreateIndex
CREATE INDEX "Product_shippingTemp_idx" ON "public"."Product"("shippingTemp");

-- AddForeignKey
ALTER TABLE "public"."ShippingZoneRule" ADD CONSTRAINT "ShippingZoneRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "public"."ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "public"."ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShippingRateTier" ADD CONSTRAINT "ShippingRateTier_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "public"."ShippingRate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
