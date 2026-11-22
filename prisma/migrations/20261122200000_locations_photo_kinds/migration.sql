-- Two more kinds of place documents.
ALTER TYPE "DocumentKind" ADD VALUE 'OPERATING_LICENSE';
ALTER TYPE "DocumentKind" ADD VALUE 'MANAGEMENT_AGREEMENT';

-- What each place photo shows.
CREATE TYPE "PhotoKind" AS ENUM ('GENERAL', 'ROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM', 'EXTERIOR', 'FACILITY');
ALTER TABLE "listingPhoto" ADD COLUMN "kind" "PhotoKind" NOT NULL DEFAULT 'GENERAL';

-- Official Rwanda locations (province, sector, cell, village; district already exists).
ALTER TABLE "listing" ADD COLUMN "province" TEXT, ADD COLUMN "sector" TEXT, ADD COLUMN "cell" TEXT, ADD COLUMN "village" TEXT, ADD COLUMN "villageCode" TEXT;
CREATE INDEX "listing_villageCode_idx" ON "listing"("villageCode");
ALTER TABLE "restaurant" ADD COLUMN "province" TEXT, ADD COLUMN "sector" TEXT, ADD COLUMN "cell" TEXT, ADD COLUMN "village" TEXT, ADD COLUMN "villageCode" TEXT;
