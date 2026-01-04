/*
  SAFE migration for ReturnCase redesign:
  - Preserves old data into meta JSONB
  - Maps old enum values safely
  - Dedupes duplicates before UNIQUE(orderId)
*/

-- 0) Create new enums (idempotent-ish)
DO $$ BEGIN
  CREATE TYPE "public"."DeliveryIssueType" AS ENUM
    ('DELIVERY_FAILED', 'RETURN_TO_DEPOT', 'RETURN_TO_SENDER', 'LOST', 'DAMAGED', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."ReturnResolution" AS ENUM
    ('RESHIP', 'REFUND', 'STORE_CREDIT', 'CUSTOMER_COLLECT', 'NO_ACTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1) Preserve existing ReturnCase data into meta BEFORE we drop columns
--    (This keeps your historical fields safely)
ALTER TABLE "public"."ReturnCase"
  ADD COLUMN IF NOT EXISTS "meta" JSONB;

UPDATE "public"."ReturnCase"
SET "meta" =
  COALESCE("meta", '{}'::jsonb)
  || jsonb_build_object(
      '__legacy', jsonb_build_object(
        'reason', "reason",
        'decision', "decision",
        'note', "note",
        'originalShipmentId', "originalShipmentId",
        'reshipShipmentId', "reshipShipmentId",
        'refundAmountPence', "refundAmountPence",
        'storeCreditPence', "storeCreditPence",
        'decidedAt', "decidedAt",
        'closedAt', "closedAt"
      )
    )
WHERE
  "reason" IS NOT NULL
  OR "decision" IS NOT NULL
  OR "note" IS NOT NULL
  OR "originalShipmentId" IS NOT NULL
  OR "reshipShipmentId" IS NOT NULL
  OR "refundAmountPence" IS NOT NULL
  OR "storeCreditPence" IS NOT NULL
  OR "decidedAt" IS NOT NULL
  OR "closedAt" IS NOT NULL;

-- 2) Add new columns first (so we can backfill them safely)
ALTER TABLE "public"."ReturnCase"
  ADD COLUMN IF NOT EXISTS "shipmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "issueType" "public"."DeliveryIssueType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "resolution" "public"."ReturnResolution",
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;

-- 3) Backfill new fields from legacy ones (best-effort mapping)

-- shipmentId: prefer originalShipmentId if present, else reshipShipmentId
UPDATE "public"."ReturnCase"
SET "shipmentId" = COALESCE("originalShipmentId", "reshipShipmentId")
WHERE "shipmentId" IS NULL;

-- detectedAt: use createdAt as "detectedAt" if you want true detection time later; for now keep createdAt mapping
UPDATE "public"."ReturnCase"
SET "detectedAt" = COALESCE("detectedAt", "createdAt")
WHERE "createdAt" IS NOT NULL;

-- lastEventAt: pick max of decidedAt/closedAt/updatedAt
UPDATE "public"."ReturnCase"
SET "lastEventAt" =
  GREATEST(
    COALESCE("decidedAt", '1970-01-01'::timestamp),
    COALESCE("closedAt",  '1970-01-01'::timestamp),
    COALESCE("updatedAt", '1970-01-01'::timestamp)
  )
WHERE "lastEventAt" IS NULL;

-- receivedAt: keep your previous receivedAt if existed; otherwise leave null
-- (your old schema already had receivedAt, so nothing needed)

-- resolvedAt: if it was closed, map closedAt -> resolvedAt
UPDATE "public"."ReturnCase"
SET "resolvedAt" = "closedAt"
WHERE "resolvedAt" IS NULL AND "closedAt" IS NOT NULL;

-- issueType mapping from old reason values (best-effort)
UPDATE "public"."ReturnCase"
SET "issueType" =
  (
    CASE
      WHEN "reason" IN ('DELIVERY_FAILED','CUSTOMER_UNAVAILABLE','ADDRESS_INCOMPLETE','REFUSED')
        THEN 'DELIVERY_FAILED'
      WHEN "reason" IN ('RETURN_TO_DEPOT')
        THEN 'RETURN_TO_DEPOT'
      WHEN "reason" IN ('RETURNED_TO_SENDER')
        THEN 'RETURN_TO_SENDER'
      WHEN "reason" IN ('DAMAGED')
        THEN 'DAMAGED'
      WHEN "reason" IN ('LOST')
        THEN 'LOST'
      ELSE 'UNKNOWN'
    END
  )::"public"."DeliveryIssueType"
WHERE "issueType" = 'UNKNOWN' AND "reason" IS NOT NULL;


-- resolution mapping from old decision values
UPDATE "public"."ReturnCase"
SET "resolution" =
  (
    CASE
      WHEN "decision" = 'RESHIP' THEN 'RESHIP'
      WHEN "decision" = 'REFUND' THEN 'REFUND'
      WHEN "decision" = 'STORE_CREDIT' THEN 'STORE_CREDIT'
      WHEN "decision" = 'NO_ACTION' THEN 'NO_ACTION'
      ELSE NULL
    END
  )::"public"."ReturnResolution"
WHERE "resolution" IS NULL AND "decision" IS NOT NULL;

-- resolutionNote: keep old note
UPDATE "public"."ReturnCase"
SET "resolutionNote" = "note"
WHERE "resolutionNote" IS NULL AND "note" IS NOT NULL;

-- 4) Convert the enum safely (handles removed variants)
--    Map: IN_TRANSIT -> OPEN, DECIDED -> RECEIVED, CLOSED -> RESOLVED
DO $$
BEGIN
  -- only run if ReturnCaseStatus currently has the legacy values
  -- (Prisma-generated enum rename path is safest if we follow it, but with a CASE mapping)
  BEGIN
    CREATE TYPE "public"."ReturnCaseStatus_new" AS ENUM ('OPEN', 'RECEIVED', 'RESOLVED');
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- remove default temporarily
  ALTER TABLE "public"."ReturnCase" ALTER COLUMN "status" DROP DEFAULT;

  -- change type with mapping
  ALTER TABLE "public"."ReturnCase"
    ALTER COLUMN "status"
    TYPE "public"."ReturnCaseStatus_new"
    USING (
      CASE "status"::text
        WHEN 'OPEN' THEN 'OPEN'::"public"."ReturnCaseStatus_new"
        WHEN 'IN_TRANSIT' THEN 'OPEN'::"public"."ReturnCaseStatus_new"
        WHEN 'RECEIVED' THEN 'RECEIVED'::"public"."ReturnCaseStatus_new"
        WHEN 'DECIDED' THEN 'RECEIVED'::"public"."ReturnCaseStatus_new"
        WHEN 'CLOSED' THEN 'RESOLVED'::"public"."ReturnCaseStatus_new"
        ELSE 'OPEN'::"public"."ReturnCaseStatus_new"
      END
    );

  -- swap types
  ALTER TYPE "public"."ReturnCaseStatus" RENAME TO "ReturnCaseStatus_old";
  ALTER TYPE "public"."ReturnCaseStatus_new" RENAME TO "ReturnCaseStatus";
  DROP TYPE "public"."ReturnCaseStatus_old";

  -- restore default
  ALTER TABLE "public"."ReturnCase" ALTER COLUMN "status" SET DEFAULT 'OPEN';
END $$;

-- 5) Deduplicate rows per orderId BEFORE adding unique(orderId)
--    Keep newest (updatedAt, then createdAt)
DELETE FROM "public"."ReturnCase" rc
USING "public"."ReturnCase" keep
WHERE rc."orderId" = keep."orderId"
  AND (
    rc."updatedAt" < keep."updatedAt"
    OR (rc."updatedAt" = keep."updatedAt" AND rc."createdAt" < keep."createdAt")
  );

-- 6) Drop old FKs + old indexes (IF EXISTS to avoid breakage)
ALTER TABLE "public"."ReturnCase"
  DROP CONSTRAINT IF EXISTS "ReturnCase_originalShipmentId_fkey";

ALTER TABLE "public"."ReturnCase"
  DROP CONSTRAINT IF EXISTS "ReturnCase_reshipShipmentId_fkey";

DROP INDEX IF EXISTS "public"."ReturnCase_orderId_idx";
DROP INDEX IF EXISTS "public"."ReturnCase_originalShipmentId_idx";
DROP INDEX IF EXISTS "public"."ReturnCase_reshipShipmentId_idx";
DROP INDEX IF EXISTS "public"."ReturnCase_status_idx";

-- 7) Now drop old columns (data already preserved in meta + backfilled)
ALTER TABLE "public"."ReturnCase"
  DROP COLUMN IF EXISTS "closedAt",
  DROP COLUMN IF EXISTS "decidedAt",
  DROP COLUMN IF EXISTS "decision",
  DROP COLUMN IF EXISTS "note",
  DROP COLUMN IF EXISTS "originalShipmentId",
  DROP COLUMN IF EXISTS "reason",
  DROP COLUMN IF EXISTS "refundAmountPence",
  DROP COLUMN IF EXISTS "reshipShipmentId",
  DROP COLUMN IF EXISTS "storeCreditPence";

-- 8) Drop old enums (if they still exist)
DROP TYPE IF EXISTS "public"."ReturnDecision";
DROP TYPE IF EXISTS "public"."ReturnReason";

-- 9) Add constraints/indexes
-- unique(orderId)
DO $$ BEGIN
  CREATE UNIQUE INDEX "ReturnCase_orderId_key" ON "public"."ReturnCase"("orderId");
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- indexes for dashboards
CREATE INDEX IF NOT EXISTS "ReturnCase_status_detectedAt_idx"
  ON "public"."ReturnCase"("status", "detectedAt");

CREATE INDEX IF NOT EXISTS "ReturnCase_issueType_detectedAt_idx"
  ON "public"."ReturnCase"("issueType", "detectedAt");

CREATE INDEX IF NOT EXISTS "ReturnCase_shipmentId_idx"
  ON "public"."ReturnCase"("shipmentId");

-- 10) FK to Shipment
ALTER TABLE "public"."ReturnCase"
  ADD CONSTRAINT "ReturnCase_shipmentId_fkey"
  FOREIGN KEY ("shipmentId")
  REFERENCES "public"."Shipment"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
