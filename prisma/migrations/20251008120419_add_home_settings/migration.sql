-- CreateTable
CREATE TABLE "public"."HomeSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hero" JSONB NOT NULL DEFAULT '{}',
    "delivery" JSONB NOT NULL DEFAULT '{}',
    "instagram" JSONB NOT NULL DEFAULT '{}',
    "promotions" JSONB NOT NULL DEFAULT '[]',
    "productShowcase" JSONB NOT NULL DEFAULT '{}',
    "reviews" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSettings_pkey" PRIMARY KEY ("id")
);
