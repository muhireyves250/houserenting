-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'REFUNDED', 'DECLINED');

-- CreateEnum
CREATE TYPE "StayRequestKind" AS ENUM ('EXTEND', 'SHORTEN', 'TRANSFER', 'CANCEL');

-- CreateEnum
CREATE TYPE "StayRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PlaceRole" AS ENUM ('MANAGER', 'RECEPTIONIST');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "refundAmount" INTEGER,
ADD COLUMN     "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "keepVisible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "platformConfig" ADD COLUMN     "dislikeHideCount" INTEGER;

-- CreateTable
CREATE TABLE "stayRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "StayRequestKind" NOT NULL,
    "status" "StayRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "newCheckOut" DATE,
    "transferTo" TEXT,
    "priceChange" INTEGER,
    "response" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stayFeedback" (
    "bookingId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stayFeedback_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "guestDocument" (
    "bookingId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guestDocument_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "placeMember" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlaceRole" NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placeMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stayRequest_bookingId_createdAt_idx" ON "stayRequest"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "stayRequest_status_createdAt_idx" ON "stayRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stayFeedback_listingId_liked_createdAt_idx" ON "stayFeedback"("listingId", "liked", "createdAt");

-- CreateIndex
CREATE INDEX "placeMember_userId_idx" ON "placeMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "placeMember_listingId_userId_key" ON "placeMember"("listingId", "userId");

-- AddForeignKey
ALTER TABLE "stayRequest" ADD CONSTRAINT "stayRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stayFeedback" ADD CONSTRAINT "stayFeedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guestDocument" ADD CONSTRAINT "guestDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placeMember" ADD CONSTRAINT "placeMember_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placeMember" ADD CONSTRAINT "placeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
