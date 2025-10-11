-- AlterTable
ALTER TABLE "public"."Faq" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."FaqSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "heading" TEXT NOT NULL DEFAULT 'FAQs',
    "subheading" TEXT NOT NULL DEFAULT 'Get answers to common questions.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FaqQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaqQuestion_askedCount_updatedAt_idx" ON "public"."FaqQuestion"("askedCount", "updatedAt");

-- CreateIndex
CREATE INDEX "Faq_position_updatedAt_idx" ON "public"."Faq"("position", "updatedAt");
