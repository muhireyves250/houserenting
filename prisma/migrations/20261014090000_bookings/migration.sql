-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "guests" INTEGER NOT NULL,
    "nightlyPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "paymentMethod" TEXT,
    "payerPhone" TEXT,
    "policySnapshot" JSONB NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookingEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_reference_key" ON "booking"("reference");

-- CreateIndex
CREATE INDEX "booking_guestId_checkIn_idx" ON "booking"("guestId", "checkIn");

-- CreateIndex
CREATE INDEX "booking_listingId_checkIn_idx" ON "booking"("listingId", "checkIn");

-- CreateIndex
CREATE INDEX "bookingEvent_bookingId_createdAt_idx" ON "bookingEvent"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingEvent" ADD CONSTRAINT "bookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No double booking: two active bookings of the same listing may not overlap (checkout day is free for the next check-in).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist (
    "listingId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "booking" ADD CONSTRAINT "booking_dates_order" CHECK ("checkOut" > "checkIn");
