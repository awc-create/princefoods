/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "stripeCustomerId" TEXT;

-- ------------------------------------------------------------------
-- ✅ DATA CLEANUP (PREVENT UNIQUE INDEX FAILURES)
-- ------------------------------------------------------------------

-- 1) Fix duplicate Product.sku values (keep oldest row, suffix the rest)
WITH d AS (
  SELECT
    id,
    sku,
    ROW_NUMBER() OVER (PARTITION BY sku ORDER BY "createdAt" ASC) AS rn
  FROM "public"."Product"
  WHERE sku IS NOT NULL AND sku <> ''
)
UPDATE "public"."Product" p
SET sku = p.sku || '-' || p.id
FROM d
WHERE p.id = d.id
  AND d.rn > 1;

-- 2) Fix duplicate User.stripeCustomerId values (keep oldest row, suffix the rest)
-- (If your User table doesn't have createdAt, switch ORDER BY to id.)
WITH u AS (
  SELECT
    id,
    "stripeCustomerId",
    ROW_NUMBER() OVER (PARTITION BY "stripeCustomerId" ORDER BY "createdAt" ASC) AS rn
  FROM "public"."User"
  WHERE "stripeCustomerId" IS NOT NULL AND "stripeCustomerId" <> ''
)
UPDATE "public"."User" x
SET "stripeCustomerId" = x."stripeCustomerId" || '-' || x.id
FROM u
WHERE x.id = u.id
  AND u.rn > 1;

-- ------------------------------------------------------------------
-- ORIGINAL MIGRATION CONTENT
-- ------------------------------------------------------------------

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "intentId" TEXT,
    "chargeId" TEXT,
    "refundId" TEXT,
    "amountPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "public"."PaymentStatus" NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stripe',
    "type" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "public"."Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "public"."Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_intentId_idx" ON "public"."Payment"("intentId");

-- CreateIndex
CREATE INDEX "Payment_chargeId_idx" ON "public"."Payment"("chargeId");

-- CreateIndex
CREATE INDEX "Payment_refundId_idx" ON "public"."Payment"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "public"."WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_type_receivedAt_idx" ON "public"."WebhookEvent"("type", "receivedAt");

-- CreateIndex
CREATE INDEX "Order_paymentIntentId_idx" ON "public"."Order"("paymentIntentId");

-- CreateIndex
CREATE INDEX "Order_contactEmail_createdAt_idx" ON "public"."Order"("contactEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product"("sku");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "public"."Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
