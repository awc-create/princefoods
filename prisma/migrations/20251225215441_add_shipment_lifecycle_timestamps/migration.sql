-- AlterTable
ALTER TABLE "public"."Shipment" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "labelReadyAt" TIMESTAMP(3),
ADD COLUMN     "voidedAt" TIMESTAMP(3);
