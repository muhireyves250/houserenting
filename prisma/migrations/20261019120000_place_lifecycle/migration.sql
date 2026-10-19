-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('OWNER', 'VIIPA');

-- CreateEnum
CREATE TYPE "GuestIdPolicy" AS ENUM ('NONE', 'UPLOAD_ONLINE', 'AT_CHECK_IN');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('MAINTENANCE', 'UNAVAILABLE', 'OFFLINE_BOOKING');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('OWNER_ID', 'OWNERSHIP_PROOF', 'MANAGEMENT_AUTHORIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('MOBILE_MONEY', 'BANK');

-- AlterEnum


ALTER TYPE "ListingType" ADD VALUE 'GUEST_HOUSE';
ALTER TYPE "ListingType" ADD VALUE 'OTHER';

-- AlterEnum


ALTER TYPE "ListingStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "ListingStatus" ADD VALUE 'HIDDEN';
ALTER TYPE "ListingStatus" ADD VALUE 'PAUSED';
ALTER TYPE "ListingStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "availableFrom" DATE,
ADD COLUMN     "availableUntil" DATE,
ADD COLUMN     "contractEnd" DATE,
ADD COLUMN     "contractStart" DATE,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestIdPolicy" "GuestIdPolicy" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "operator" "Operator" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "workingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "availabilityBlock" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "roomId" TEXT,
    "kind" "BlockKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,

    CONSTRAINT "availabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listingDocument" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availabilityBlock_listingId_startsAt_idx" ON "availabilityBlock"("listingId", "startsAt");

-- CreateIndex
CREATE INDEX "listingDocument_listingId_idx" ON "listingDocument"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "payoutAccount_userId_key" ON "payoutAccount"("userId");

-- AddForeignKey
ALTER TABLE "availabilityBlock" ADD CONSTRAINT "availabilityBlock_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listingDocument" ADD CONSTRAINT "listingDocument_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoutAccount" ADD CONSTRAINT "payoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
