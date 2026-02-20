/*
  Warnings:

  - You are about to drop the column `key` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Media` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Media` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Media" DROP COLUMN "key",
DROP COLUMN "provider",
ADD COLUMN     "name" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Media_kind_idx" ON "public"."Media"("kind");
