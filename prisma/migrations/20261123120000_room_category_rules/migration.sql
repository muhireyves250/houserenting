-- Each room category has its own booking rules per unit, discount and laundry price (requirements: per category).
ALTER TABLE "roomRate" ADD COLUMN "minUnits" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "maxUnits" INTEGER, ADD COLUMN "checkInTime" TEXT, ADD COLUMN "checkOutTime" TEXT, ADD COLUMN "dayStartTime" TEXT, ADD COLUMN "dayEndTime" TEXT;
ALTER TABLE "room" ADD COLUMN "discountPercent" INTEGER, ADD COLUMN "laundryPricePerKg" INTEGER;
