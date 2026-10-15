-- Booking by hour, day, night, week, month or year.
ALTER TYPE "RateUnit" ADD VALUE IF NOT EXISTS 'WEEK';
ALTER TYPE "RateUnit" ADD VALUE IF NOT EXISTS 'YEAR';

-- Rooms get a price per way of booking; their nightly price becomes a NIGHT rate.
CREATE TABLE "roomRate" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "unit" "RateUnit" NOT NULL,
    "price" INTEGER NOT NULL,
    CONSTRAINT "roomRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roomRate_price_positive" CHECK ("price" >= 100)
);
CREATE UNIQUE INDEX "roomRate_roomId_unit_key" ON "roomRate"("roomId", "unit");
ALTER TABLE "roomRate" ADD CONSTRAINT "roomRate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "roomRate" ("id", "roomId", "unit", "price") SELECT 'rr_' || "id", "id", 'NIGHT', "nightlyPrice" FROM "room";
ALTER TABLE "room" DROP CONSTRAINT IF EXISTS "room_values";
ALTER TABLE "room" DROP COLUMN "nightlyPrice";
ALTER TABLE "room" ADD CONSTRAINT "room_values" CHECK ("maxGuests" >= 1);

-- Bookings: exact start and end (Kigali midnight for day-based bookings), unit and quantity.
ALTER TABLE "booking" ADD COLUMN "unit" "RateUnit" NOT NULL DEFAULT 'NIGHT';
ALTER TABLE "booking" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "booking" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "booking" ADD COLUMN "endAt" TIMESTAMP(3);
UPDATE "booking" SET
    "startAt" = ("checkIn"::timestamp - interval '2 hours'),
    "endAt" = ("checkOut"::timestamp - interval '2 hours'),
    "unit" = CASE WHEN "rentalMode" = 'MONTHLY' THEN 'MONTH'::"RateUnit" ELSE 'NIGHT'::"RateUnit" END,
    "quantity" = CASE WHEN "rentalMode" = 'MONTHLY' THEN COALESCE("months", 1) ELSE GREATEST("nights", 1) END;
ALTER TABLE "booking" ALTER COLUMN "startAt" SET NOT NULL;
ALTER TABLE "booking" ALTER COLUMN "endAt" SET NOT NULL;
ALTER TABLE "booking" ADD CONSTRAINT "booking_times_order" CHECK ("endAt" > "startAt");
ALTER TABLE "booking" ADD CONSTRAINT "booking_quantity_positive" CHECK ("quantity" >= 1);

-- No double booking, now on exact times (an hourly booking and a night stay can't overlap either).
ALTER TABLE "booking" DROP CONSTRAINT "booking_no_overlap";
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist (
    "listingId" WITH =,
    (COALESCE("roomId", '')) WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));
CREATE INDEX "booking_listingId_startAt_idx" ON "booking"("listingId", "startAt");
