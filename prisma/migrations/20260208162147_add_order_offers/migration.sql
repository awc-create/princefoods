-- CreateTable
CREATE TABLE "public"."OrderOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "emailUsed" TEXT,
    "offerId" TEXT NOT NULL,
    "offerName" TEXT NOT NULL,
    "offerKind" TEXT,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderOffer_orderId_appliedAt_idx" ON "public"."OrderOffer"("orderId", "appliedAt");

-- CreateIndex
CREATE INDEX "OrderOffer_userId_appliedAt_idx" ON "public"."OrderOffer"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "OrderOffer_emailUsed_appliedAt_idx" ON "public"."OrderOffer"("emailUsed", "appliedAt");

-- CreateIndex
CREATE INDEX "OrderOffer_offerId_appliedAt_idx" ON "public"."OrderOffer"("offerId", "appliedAt");

-- AddForeignKey
ALTER TABLE "public"."OrderOffer" ADD CONSTRAINT "OrderOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOffer" ADD CONSTRAINT "OrderOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
