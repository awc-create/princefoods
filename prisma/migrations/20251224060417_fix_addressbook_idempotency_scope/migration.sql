/*
  Warnings:

  - A unique constraint covering the columns `[userId,idempotencyKey]` on the table `AddressBook` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."AddressBook_idempotencyKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "AddressBook_userId_idempotencyKey_key" ON "public"."AddressBook"("userId", "idempotencyKey");
