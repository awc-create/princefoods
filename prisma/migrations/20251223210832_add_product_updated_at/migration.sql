-- CreateEnum
CREATE TYPE "public"."AddressKind" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "additionalInfoDescription10" TEXT,
ADD COLUMN     "additionalInfoDescription7" TEXT,
ADD COLUMN     "additionalInfoDescription8" TEXT,
ADD COLUMN     "additionalInfoDescription9" TEXT,
ADD COLUMN     "additionalInfoTitle10" TEXT,
ADD COLUMN     "additionalInfoTitle7" TEXT,
ADD COLUMN     "additionalInfoTitle8" TEXT,
ADD COLUMN     "additionalInfoTitle9" TEXT,
ADD COLUMN     "productOptionDescription10" TEXT,
ADD COLUMN     "productOptionDescription11" TEXT,
ADD COLUMN     "productOptionDescription12" TEXT,
ADD COLUMN     "productOptionDescription13" TEXT,
ADD COLUMN     "productOptionDescription14" TEXT,
ADD COLUMN     "productOptionDescription15" TEXT,
ADD COLUMN     "productOptionDescription7" TEXT,
ADD COLUMN     "productOptionDescription8" TEXT,
ADD COLUMN     "productOptionDescription9" TEXT,
ADD COLUMN     "productOptionName10" TEXT,
ADD COLUMN     "productOptionName11" TEXT,
ADD COLUMN     "productOptionName12" TEXT,
ADD COLUMN     "productOptionName13" TEXT,
ADD COLUMN     "productOptionName14" TEXT,
ADD COLUMN     "productOptionName15" TEXT,
ADD COLUMN     "productOptionName7" TEXT,
ADD COLUMN     "productOptionName8" TEXT,
ADD COLUMN     "productOptionName9" TEXT,
ADD COLUMN     "productOptionType10" TEXT,
ADD COLUMN     "productOptionType11" TEXT,
ADD COLUMN     "productOptionType12" TEXT,
ADD COLUMN     "productOptionType13" TEXT,
ADD COLUMN     "productOptionType14" TEXT,
ADD COLUMN     "productOptionType15" TEXT,
ADD COLUMN     "productOptionType7" TEXT,
ADD COLUMN     "productOptionType8" TEXT,
ADD COLUMN     "productOptionType9" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."AddressBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "kind" "public"."AddressKind" NOT NULL DEFAULT 'SHIPPING',
    "firstName" TEXT,
    "lastName" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "town" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phoneE164" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AddressBook_userId_idx" ON "public"."AddressBook"("userId");

-- CreateIndex
CREATE INDEX "AddressBook_userId_isDefault_idx" ON "public"."AddressBook"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AddressBook_userId_label_key" ON "public"."AddressBook"("userId", "label");

-- AddForeignKey
ALTER TABLE "public"."AddressBook" ADD CONSTRAINT "AddressBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
