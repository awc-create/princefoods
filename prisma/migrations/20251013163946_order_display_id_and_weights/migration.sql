-- Add columns (nullable first so we can backfill)
ALTER TABLE "Order" ADD COLUMN "displayId" TEXT;
ALTER TABLE "Order" ADD COLUMN "totalWeightGrams" INTEGER;

-- Add column to OrderItem for per-unit weight snapshot
ALTER TABLE "OrderItem" ADD COLUMN "unitWeightGrams" INTEGER;

-- Backfill displayId for existing orders:
-- Derive from the existing cuid: strip dashes, take 8 chars, uppercase.
UPDATE "Order"
SET "displayId" = UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8))
WHERE "displayId" IS NULL;

-- Now enforce NOT NULL + UNIQUE
ALTER TABLE "Order" ALTER COLUMN "displayId" SET NOT NULL;
CREATE UNIQUE INDEX "Order_displayId_key" ON "Order"("displayId");
