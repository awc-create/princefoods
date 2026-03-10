-- CreateTable
CREATE TABLE "public"."CustomerDiscount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "percentOff" INTEGER NOT NULL,
    "applyShippingDiscount" BOOLEAN NOT NULL DEFAULT false,
    "shippingPercentOffDry" INTEGER,
    "shippingPercentOffFrozen" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderCustomerDiscount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerDiscountId" TEXT,
    "userId" TEXT,
    "percentOff" INTEGER NOT NULL,
    "applyShippingDiscount" BOOLEAN NOT NULL,
    "shippingPercentOffDry" INTEGER,
    "shippingPercentOffFrozen" INTEGER,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "shippingDiscountPence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCustomerDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerDiscount_userId_createdAt_idx" ON "public"."CustomerDiscount"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerDiscount_userId_startsAt_endsAt_idx" ON "public"."CustomerDiscount"("userId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CustomerDiscount_revokedAt_idx" ON "public"."CustomerDiscount"("revokedAt");

-- CreateIndex
CREATE INDEX "OrderCustomerDiscount_orderId_idx" ON "public"."OrderCustomerDiscount"("orderId");

-- CreateIndex
CREATE INDEX "OrderCustomerDiscount_userId_createdAt_idx" ON "public"."OrderCustomerDiscount"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderCustomerDiscount_customerDiscountId_idx" ON "public"."OrderCustomerDiscount"("customerDiscountId");

-- AddForeignKey
ALTER TABLE "public"."CustomerDiscount" ADD CONSTRAINT "CustomerDiscount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDiscount" ADD CONSTRAINT "CustomerDiscount_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderCustomerDiscount" ADD CONSTRAINT "OrderCustomerDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderCustomerDiscount" ADD CONSTRAINT "OrderCustomerDiscount_customerDiscountId_fkey" FOREIGN KEY ("customerDiscountId") REFERENCES "public"."CustomerDiscount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderCustomerDiscount" ADD CONSTRAINT "OrderCustomerDiscount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
