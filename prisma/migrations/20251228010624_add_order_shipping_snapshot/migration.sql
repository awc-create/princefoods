-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "shippingRateId" TEXT,
ADD COLUMN     "shippingService" "public"."ShippingService",
ADD COLUMN     "shippingTemp" "public"."ShippingTemp",
ADD COLUMN     "shippingZoneId" TEXT;
