-- Room types with several numbered rooms: each number can be booked once at a time; the guest is given a free one.
ALTER TABLE "room" ADD COLUMN "numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "booking" ADD COLUMN "roomNumber" TEXT;

-- No double booking per room number (rooms without numbers behave as before: one booking at a time).
ALTER TABLE "booking" DROP CONSTRAINT "booking_no_overlap";
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist (
    "listingId" WITH =,
    (COALESCE("roomId", '')) WITH =,
    (COALESCE("roomNumber", '')) WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));
