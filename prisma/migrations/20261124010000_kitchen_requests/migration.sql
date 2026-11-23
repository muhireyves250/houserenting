-- CreateEnum
CREATE TYPE "KitchenRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "kitchenRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "note" TEXT,
    "status" "KitchenRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchenRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchenRequest_status_createdAt_idx" ON "kitchenRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "kitchenRequest_restaurantId_idx" ON "kitchenRequest"("restaurantId");

-- CreateIndex
CREATE INDEX "kitchenRequest_listingId_idx" ON "kitchenRequest"("listingId");

-- AddForeignKey
ALTER TABLE "kitchenRequest" ADD CONSTRAINT "kitchenRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchenRequest" ADD CONSTRAINT "kitchenRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

