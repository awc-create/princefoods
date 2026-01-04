/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Shipment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "public"."Shipment"("idempotencyKey");
