/*
  Warnings:

  - Made the column `offerId` on table `OfferAttempt` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."OfferAttempt" ALTER COLUMN "offerId" SET NOT NULL;
