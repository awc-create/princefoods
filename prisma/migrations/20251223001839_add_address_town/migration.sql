-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "town" TEXT;

-- AlterTable
ALTER TABLE "public"."Shipment" ALTER COLUMN "trackingEmailSentAt" SET DATA TYPE TIMESTAMP(3);
