-- AlterEnum
ALTER TYPE "PromoterStatus" ADD VALUE 'ENDED';

-- AlterTable
ALTER TABLE "promoter" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "startsAt" TIMESTAMP(3);

