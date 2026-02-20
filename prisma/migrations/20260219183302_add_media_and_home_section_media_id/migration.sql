-- AlterTable
ALTER TABLE "public"."HomeSection" ADD COLUMN     "mediaId" TEXT;

-- CreateTable
CREATE TABLE "public"."Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "provider" TEXT DEFAULT 'uploadthing',
    "kind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "public"."Media"("createdAt");

-- CreateIndex
CREATE INDEX "HomeSection_mediaId_idx" ON "public"."HomeSection"("mediaId");

-- AddForeignKey
ALTER TABLE "public"."HomeSection" ADD CONSTRAINT "HomeSection_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
