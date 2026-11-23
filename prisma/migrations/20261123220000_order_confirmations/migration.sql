-- AlterTable
ALTER TABLE "foodOrder" ADD COLUMN     "courierConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "deskConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "deskConfirmedById" TEXT,
ADD COLUMN     "guestConfirmedAt" TIMESTAMP(3);

