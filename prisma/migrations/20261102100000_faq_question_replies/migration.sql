-- FAQ question replies.
--
-- Lets a customer leave an email with their question and lets an admin answer
-- it: the answer is emailed, and a logged-in asker also reads it back in their
-- account. Previously FaqQuestion stored only the text, so nothing submitted
-- through the "ask us" box could ever be replied to.
--
-- Written by hand rather than by `prisma migrate dev` because the environment
-- it was authored in cannot reach binaries.prisma.sh. Every statement is
-- idempotent so a partial run can safely be repeated.

-- Status of a submitted question.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaqQuestionStatus') THEN
    CREATE TYPE "FaqQuestionStatus" AS ENUM ('NEW', 'ANSWERED', 'DISMISSED');
  END IF;
END
$$;

-- Who asked. All nullable: anonymous questions are still accepted, they just
-- cannot be replied to.
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "askerEmail"  TEXT;
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "askerName"   TEXT;
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "askerUserId" TEXT;

-- The reply.
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "status"
  "FaqQuestionStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "answer"          TEXT;
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "answeredAt"      TIMESTAMP(3);
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "answeredByEmail" TEXT;
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "readAt"          TIMESTAMP(3);
ALTER TABLE "FaqQuestion" ADD COLUMN IF NOT EXISTS "publishedFaqId"  TEXT;

-- The admin inbox filters by status, and the account page lists one user's
-- questions newest-first. Both would otherwise be sequential scans.
CREATE INDEX IF NOT EXISTS "FaqQuestion_status_updatedAt_idx"
  ON "FaqQuestion" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "FaqQuestion_askerUserId_updatedAt_idx"
  ON "FaqQuestion" ("askerUserId", "updatedAt");
