-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "checkedOutEarlyAt" TIMESTAMP(3),
ADD COLUMN     "earlyCheckoutAppeal" TEXT,
ADD COLUMN     "earlyCheckoutAppealAt" TIMESTAMP(3),
ADD COLUMN     "earlyCheckoutById" TEXT,
ADD COLUMN     "earlyCheckoutReason" TEXT;

