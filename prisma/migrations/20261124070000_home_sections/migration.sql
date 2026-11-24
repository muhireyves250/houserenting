-- CreateEnum
CREATE TYPE "HomeSectionKind" AS ENUM ('CUSTOM', 'HOT_DEALS');

-- CreateTable
CREATE TABLE "homeSection" (
    "id" TEXT NOT NULL,
    "kind" "HomeSectionKind" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "places" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'short',
    "houseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homeSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homeSection_active_position_idx" ON "homeSection"("active", "position");


-- Today's rows, now run by VIIPA (Hot deals replaces Recently viewed, at the top).
INSERT INTO "homeSection" ("id", "kind", "title", "subtitle", "places", "types", "mode", "position", "updatedAt") VALUES
  ('home-hot-deals', 'HOT_DEALS', 'Hot deals', 'The most booked places right now', '{}', '{}', 'short', 0, CURRENT_TIMESTAMP),
  ('home-kigali', 'CUSTOM', 'Popular homes in Kigali', 'Rwanda''s capital, close to everything', '{Kigali}', '{}', 'short', 1, CURRENT_TIMESTAMP),
  ('home-volcanoes', 'CUSTOM', 'Stays near the volcanoes', 'Gateway to Volcanoes National Park', '{Musanze}', '{}', 'short', 2, CURRENT_TIMESTAMP),
  ('home-kivu', 'CUSTOM', 'Lake Kivu escapes', 'Beaches, sunsets and boat trips', '{Rubavu,Karongi}', '{}', 'short', 3, CURRENT_TIMESTAMP),
  ('home-long', 'CUSTOM', 'Homes for long stays', 'Monthly rentals from 6 months', '{}', '{}', 'long', 4, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
