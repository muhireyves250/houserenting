-- CreateEnum
CREATE TYPE "IdentityRequirement" AS ENUM ('NONE', 'ID', 'ID_NATIONALITY');

-- AlterTable
ALTER TABLE "platformConfig" ADD COLUMN     "monthlyIdentity" "IdentityRequirement" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "bookingIdentity" (
    "bookingId" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "nationality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookingIdentity_pkey" PRIMARY KEY ("bookingId")
);

-- AddForeignKey
ALTER TABLE "bookingIdentity" ADD CONSTRAINT "bookingIdentity_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

