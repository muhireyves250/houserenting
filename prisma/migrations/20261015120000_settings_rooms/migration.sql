-- CreateEnum
CREATE TYPE "BookingModel" AS ENUM ('WHOLE_PROPERTY', 'ROOM_BY_ROOM', 'BOTH');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE', 'CLEANING');

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "bookingModel" "BookingModel" NOT NULL DEFAULT 'WHOLE_PROPERTY';

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "commission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guestFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hostPayout" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "subtotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "room" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxGuests" INTEGER NOT NULL,
    "nightlyPrice" INTEGER NOT NULL,
    "facilities" "Facility"[],
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platformConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commissionBps" INTEGER,
    "guestFeeBps" INTEGER,
    "holdMinutes" INTEGER,
    "monthlyDepositPercent" INTEGER,
    "cancellationPolicy" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "platformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_listingId_position_idx" ON "room"("listingId", "position");

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing bookings: no fee or commission was configured, so the whole price is the stay and the owner's share.
UPDATE "booking" SET "subtotal" = "total", "hostPayout" = "total" WHERE "subtotal" = 0;

-- Double booking with rooms: the same room (or the whole place, roomId NULL) can't overlap itself.
-- A whole-place booking against a room booking is checked inside a per-listing lock when booking.
ALTER TABLE "booking" DROP CONSTRAINT "booking_no_overlap";
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist (
    "listingId" WITH =,
    (COALESCE("roomId", '')) WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "platformConfig" ADD CONSTRAINT "platformConfig_single_row" CHECK ("id" = 1);
ALTER TABLE "platformConfig" ADD CONSTRAINT "platformConfig_ranges" CHECK (
    ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 5000) AND
    ("guestFeeBps" IS NULL OR "guestFeeBps" BETWEEN 0 AND 5000) AND
    ("holdMinutes" IS NULL OR "holdMinutes" BETWEEN 5 AND 1440) AND
    ("monthlyDepositPercent" IS NULL OR "monthlyDepositPercent" BETWEEN 0 AND 1200)
);
ALTER TABLE "room" ADD CONSTRAINT "room_values" CHECK ("maxGuests" >= 1 AND "nightlyPrice" >= 100);
