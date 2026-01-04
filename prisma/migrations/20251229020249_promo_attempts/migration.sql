-- CreateEnum
CREATE TYPE "public"."PromoAttemptOutcome" AS ENUM ('EVAL_OK', 'EVAL_ERR', 'ORDER_APPLIED', 'ORDER_NOT_APPLIED', 'ORDER_REJECTED');

-- CreateTable
CREATE TABLE "public"."PromotionAttempt" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT,
    "code" TEXT NOT NULL,
    "promotionId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "orderId" TEXT,
    "outcome" "public"."PromoAttemptOutcome" NOT NULL,
    "errorCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotalPence" INTEGER,
    "shippingPence" INTEGER,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "shippingDiscountPence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionAttempt_code_idx" ON "public"."PromotionAttempt"("code");

-- CreateIndex
CREATE INDEX "PromotionAttempt_promotionId_idx" ON "public"."PromotionAttempt"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionAttempt_userId_idx" ON "public"."PromotionAttempt"("userId");

-- CreateIndex
CREATE INDEX "PromotionAttempt_email_idx" ON "public"."PromotionAttempt"("email");

-- CreateIndex
CREATE INDEX "PromotionAttempt_orderId_idx" ON "public"."PromotionAttempt"("orderId");

-- CreateIndex
CREATE INDEX "PromotionAttempt_createdAt_idx" ON "public"."PromotionAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "PromotionAttempt_checkoutId_createdAt_idx" ON "public"."PromotionAttempt"("checkoutId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."PromotionAttempt" ADD CONSTRAINT "PromotionAttempt_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionAttempt" ADD CONSTRAINT "PromotionAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
