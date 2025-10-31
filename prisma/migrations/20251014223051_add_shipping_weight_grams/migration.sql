-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "shippingWeightGrams" INTEGER;

-- CreateIndex
CREATE INDEX "Product_shippingWeightGrams_idx" ON "public"."Product"("shippingWeightGrams");
