-- Laundry service for guests during a stay.
CREATE TYPE "LaundryStatus" AS ENUM ('REQUESTED', 'PICKED_UP', 'WASHED', 'RETURNED', 'CANCELLED');

ALTER TABLE "listing" ADD COLUMN "laundryPricePerKg" INTEGER;

CREATE TABLE "laundryOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "LaundryStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "pricePerKg" INTEGER NOT NULL,
    "weightGrams" INTEGER,
    "amount" INTEGER,
    "paymentClaim" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidReference" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "laundryOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "laundryOrder_reference_key" ON "laundryOrder"("reference");
CREATE UNIQUE INDEX "laundryOrder_paidReference_key" ON "laundryOrder"("paidReference");
CREATE INDEX "laundryOrder_status_createdAt_idx" ON "laundryOrder"("status", "createdAt");
CREATE INDEX "laundryOrder_bookingId_idx" ON "laundryOrder"("bookingId");

ALTER TABLE "laundryOrder" ADD CONSTRAINT "laundryOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "laundryOrder" ADD CONSTRAINT "laundryOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
