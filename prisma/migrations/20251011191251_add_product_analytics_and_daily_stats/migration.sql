-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revenuePence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitsSold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."ProductDailyStat" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "revenuePence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductDailyStat_day_idx" ON "public"."ProductDailyStat"("day");

-- CreateIndex
CREATE INDEX "ProductDailyStat_views_idx" ON "public"."ProductDailyStat"("views");

-- CreateIndex
CREATE INDEX "ProductDailyStat_clicks_idx" ON "public"."ProductDailyStat"("clicks");

-- CreateIndex
CREATE INDEX "ProductDailyStat_unitsSold_idx" ON "public"."ProductDailyStat"("unitsSold");

-- CreateIndex
CREATE INDEX "ProductDailyStat_revenuePence_idx" ON "public"."ProductDailyStat"("revenuePence");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDailyStat_productId_day_key" ON "public"."ProductDailyStat"("productId", "day");

-- CreateIndex
CREATE INDEX "Product_views_idx" ON "public"."Product"("views");

-- CreateIndex
CREATE INDEX "Product_clicks_idx" ON "public"."Product"("clicks");

-- CreateIndex
CREATE INDEX "Product_unitsSold_idx" ON "public"."Product"("unitsSold");

-- CreateIndex
CREATE INDEX "Product_revenuePence_idx" ON "public"."Product"("revenuePence");

-- AddForeignKey
ALTER TABLE "public"."ProductDailyStat" ADD CONSTRAINT "ProductDailyStat_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
