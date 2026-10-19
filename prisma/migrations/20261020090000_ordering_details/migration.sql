-- AlterTable
ALTER TABLE "restaurant" ADD COLUMN "prepMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "minOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "menuItem" ADD COLUMN "photoUrl" TEXT;
