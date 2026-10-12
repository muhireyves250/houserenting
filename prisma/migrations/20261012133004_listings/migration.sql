-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('APARTMENT', 'DUPLEX', 'PRIVATE_HOUSE', 'LODGE', 'ROOM');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('HOUR', 'DAY', 'NIGHT', 'MONTH');

-- CreateEnum
CREATE TYPE "Facility" AS ENUM ('KITCHEN', 'WIFI', 'AIR_CONDITIONER', 'WORKPLACE', 'WASHING_MACHINE', 'DISHWASHER', 'OVEN', 'MICROWAVE', 'PARKING', 'TV', 'HOT_WATER', 'SECURITY', 'GENERATOR', 'POOL');

-- CreateTable
CREATE TABLE "listing" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "addressLine" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'RW',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "sizeM2" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "facilities" "Facility"[],
    "characteristics" TEXT[],
    "termsOfRent" TEXT[],
    "depositMonths" INTEGER,
    "discountPercent" INTEGER,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "listingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateOption" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "unit" "RateUnit" NOT NULL,
    "price" INTEGER NOT NULL,
    "minUnits" INTEGER NOT NULL DEFAULT 1,
    "maxUnits" INTEGER,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "dayStartTime" TEXT,
    "dayEndTime" TEXT,

    CONSTRAINT "rateOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_status_city_idx" ON "listing"("status", "city");

-- CreateIndex
CREATE INDEX "listing_hostId_idx" ON "listing"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "listingPhoto_listingId_position_key" ON "listingPhoto"("listingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "rateOption_listingId_unit_key" ON "rateOption"("listingId", "unit");

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingPhoto" ADD CONSTRAINT "listingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateOption" ADD CONSTRAINT "rateOption_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
