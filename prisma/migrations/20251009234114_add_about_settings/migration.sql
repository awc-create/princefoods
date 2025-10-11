-- CreateTable
CREATE TABLE "public"."AboutSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hero" JSONB,
    "media" JSONB,
    "story" JSONB,
    "stats" JSONB,
    "values" JSONB,
    "cta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutSettings_pkey" PRIMARY KEY ("id")
);
