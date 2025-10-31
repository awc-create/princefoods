-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "cancelReversalReason" TEXT,
ADD COLUMN     "cancelReversedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReversibleUntil" TIMESTAMP(3),
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "refundAmountPence" INTEGER,
ADD COLUMN     "refundExecutedAt" TIMESTAMP(3),
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "refundQueuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_cancellationRequestedAt_idx" ON "public"."Order"("cancellationRequestedAt");

-- CreateIndex
CREATE INDEX "Order_cancelReversibleUntil_idx" ON "public"."Order"("cancelReversibleUntil");

-- CreateIndex
CREATE INDEX "Order_refundQueuedAt_idx" ON "public"."Order"("refundQueuedAt");

-- CreateIndex
CREATE INDEX "Order_refundExecutedAt_idx" ON "public"."Order"("refundExecutedAt");
