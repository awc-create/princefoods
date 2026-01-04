/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `AddressBook` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."AddressBook" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AddressBook_idempotencyKey_key" ON "public"."AddressBook"("idempotencyKey");
