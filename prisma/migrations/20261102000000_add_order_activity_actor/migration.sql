-- Records WHICH staff member performed each order action.
--
-- OrderActivity previously stored what happened but not who did it, so with
-- HEAD/STAFF/VIEWER accounts there was no accountability for cancellations,
-- refunds or status changes.
--
-- Both columns are nullable: additive, no table rewrite, no backfill, safe to
-- run on a live table. Existing rows keep NULL (= system/unknown actor).

ALTER TABLE "OrderActivity" ADD COLUMN IF NOT EXISTS "actorId"    TEXT;
ALTER TABLE "OrderActivity" ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;

CREATE INDEX IF NOT EXISTS "OrderActivity_actorId_idx" ON "OrderActivity"("actorId");

-- Indexes for how the admin orders list actually queries.
-- Every request filters archivedAt (the default view is active-only) and sorts
-- by createdAt desc; paymentStatus is the other common filter. Neither was
-- indexed. CONCURRENTLY is deliberately NOT used so this runs inside Prisma's
-- migration transaction — the table is small enough today that the brief lock
-- is harmless, and doing it now avoids a painful rebuild later.

CREATE INDEX IF NOT EXISTS "Order_archivedAt_createdAt_idx"    ON "Order"("archivedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
