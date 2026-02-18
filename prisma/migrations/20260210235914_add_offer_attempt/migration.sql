-- CreateEnum
CREATE TYPE "public"."OfferAttemptOutcome" AS ENUM ('EVAL_OK', 'EVAL_ERR', 'ORDER_APPLIED', 'ORDER_NOT_APPLIED', 'ORDER_REJECTED', 'ORDER_USED');

-- CreateTable
CREATE TABLE "public"."OfferAttempt" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT,
    "offerId" TEXT,
    "offerName" TEXT,
    "offerKind" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "orderId" TEXT,
    "outcome" "public"."OfferAttemptOutcome" NOT NULL,
    "errorCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotalPence" INTEGER,
    "shippingPence" INTEGER,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "shippingDiscountPence" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferAttempt_offerId_idx" ON "public"."OfferAttempt"("offerId");

-- CreateIndex
CREATE INDEX "OfferAttempt_offerName_idx" ON "public"."OfferAttempt"("offerName");

-- CreateIndex
CREATE INDEX "OfferAttempt_userId_idx" ON "public"."OfferAttempt"("userId");

-- CreateIndex
CREATE INDEX "OfferAttempt_email_idx" ON "public"."OfferAttempt"("email");

-- CreateIndex
CREATE INDEX "OfferAttempt_orderId_idx" ON "public"."OfferAttempt"("orderId");

-- CreateIndex
CREATE INDEX "OfferAttempt_createdAt_idx" ON "public"."OfferAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "OfferAttempt_checkoutId_createdAt_idx" ON "public"."OfferAttempt"("checkoutId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."OfferAttempt" ADD CONSTRAINT "OfferAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OfferAttempt" ADD CONSTRAINT "OfferAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
