-- CreateEnum
CREATE TYPE "public"."ReturnCaseStatus" AS ENUM ('OPEN', 'IN_TRANSIT', 'RECEIVED', 'DECIDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ReturnReason" AS ENUM ('DELIVERY_FAILED', 'RETURN_TO_DEPOT', 'RETURNED_TO_SENDER', 'ADDRESS_INCOMPLETE', 'CUSTOMER_UNAVAILABLE', 'REFUSED', 'DAMAGED', 'LOST', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReturnDecision" AS ENUM ('RESHIP', 'REFUND', 'STORE_CREDIT', 'NO_ACTION');

-- AlterTable
ALTER TABLE "public"."Shipment" ADD COLUMN     "reshipOfShipmentId" TEXT;

-- CreateTable
CREATE TABLE "public"."ReturnCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originalShipmentId" TEXT,
    "reshipShipmentId" TEXT,
    "status" "public"."ReturnCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reason" "public"."ReturnReason" NOT NULL DEFAULT 'OTHER',
    "decision" "public"."ReturnDecision",
    "note" TEXT,
    "refundAmountPence" INTEGER,
    "storeCreditPence" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnCase_orderId_idx" ON "public"."ReturnCase"("orderId");

-- CreateIndex
CREATE INDEX "ReturnCase_status_idx" ON "public"."ReturnCase"("status");

-- CreateIndex
CREATE INDEX "ReturnCase_originalShipmentId_idx" ON "public"."ReturnCase"("originalShipmentId");

-- CreateIndex
CREATE INDEX "ReturnCase_reshipShipmentId_idx" ON "public"."ReturnCase"("reshipShipmentId");

-- CreateIndex
CREATE INDEX "Shipment_reshipOfShipmentId_idx" ON "public"."Shipment"("reshipOfShipmentId");

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_reshipOfShipmentId_fkey" FOREIGN KEY ("reshipOfShipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnCase" ADD CONSTRAINT "ReturnCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnCase" ADD CONSTRAINT "ReturnCase_originalShipmentId_fkey" FOREIGN KEY ("originalShipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnCase" ADD CONSTRAINT "ReturnCase_reshipShipmentId_fkey" FOREIGN KEY ("reshipShipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
