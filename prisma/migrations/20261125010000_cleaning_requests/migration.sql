-- CreateTable
CREATE TABLE "cleaningRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleaningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cleaningRequest_listingId_doneAt_idx" ON "cleaningRequest"("listingId", "doneAt");

-- CreateIndex
CREATE INDEX "cleaningRequest_bookingId_idx" ON "cleaningRequest"("bookingId");

-- AddForeignKey
ALTER TABLE "cleaningRequest" ADD CONSTRAINT "cleaningRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

