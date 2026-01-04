-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityType" ADD VALUE 'SHIPMENT_CREATED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'LABEL_PURCHASED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'SHIPMENT_SHIPPED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'SHIPMENT_CANCELLED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'SHIPMENT_DELIVERED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_OPENED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_RECEIVED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_RESHIP_CREATED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_DECIDED_REFUND';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_DECIDED_STORE_CREDIT';
ALTER TYPE "public"."ActivityType" ADD VALUE 'RETURN_CLOSED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'TAG_ADDED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'TAG_REMOVED';
