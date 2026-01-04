-- DropIndex (safe)
DROP INDEX IF EXISTS "public"."Shipment_carrier_trackingNumber_idx";

-- AlterTable
ALTER TABLE "public"."Shipment"
  ADD COLUMN IF NOT EXISTS "costTotal" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS "labelBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "labelMime" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceCode" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingEvents" JSONB,
  ADD COLUMN IF NOT EXISTS "waybill" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingEmailSentAt" TIMESTAMPTZ,
  ALTER COLUMN "carrier" SET DEFAULT 'APC',
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex (safe)
CREATE INDEX IF NOT EXISTS "Shipment_carrier_serviceCode_idx"
  ON "public"."Shipment"("carrier", "serviceCode");

CREATE INDEX IF NOT EXISTS "Shipment_waybill_idx"
  ON "public"."Shipment"("waybill");

CREATE INDEX IF NOT EXISTS "Shipment_trackingNumber_idx"
  ON "public"."Shipment"("trackingNumber");
