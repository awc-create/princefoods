-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "canceledReason" TEXT,
ADD COLUMN     "editableUntil" TIMESTAMP(3),
ADD COLUMN     "notesAdmin" TEXT,
ADD COLUMN     "refundTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "labelUrl" TEXT,
    "weightGrams" INTEGER,
    "costPence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'purchased',
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "public"."Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_carrier_trackingNumber_idx" ON "public"."Shipment"("carrier", "trackingNumber");

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
