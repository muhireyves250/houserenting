-- CreateEnum
CREATE TYPE "RestaurantStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RestaurantRole" AS ENUM ('MANAGER', 'STAFF', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('PICKUP', 'DELIVERY', 'TO_STAY');

-- CreateEnum
CREATE TYPE "PromoterStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FeeModel" AS ENUM ('ADD_ON', 'INCLUDED');

-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE 'PROMOTER_REWARD';

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "promoterId" TEXT;

-- AlterTable
ALTER TABLE "platformConfig" ADD COLUMN     "citBps" INTEGER,
ADD COLUMN     "commissionByType" JSONB,
ADD COLUMN     "feeModel" "FeeModel" NOT NULL DEFAULT 'ADD_ON',
ADD COLUMN     "promoterEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promoterRewardBps" INTEGER,
ADD COLUMN     "promoterRewardFixed" INTEGER,
ADD COLUMN     "vatBps" INTEGER;

-- CreateTable
CREATE TABLE "restaurant" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "listingId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "addressLine" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "openingHours" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "pickup" BOOLEAN NOT NULL DEFAULT true,
    "delivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryKm" INTEGER NOT NULL DEFAULT 5,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "status" "RestaurantStatus" NOT NULL DEFAULT 'DRAFT',
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurantMember" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RestaurantRole" NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foodOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "fulfilment" "Fulfilment" NOT NULL,
    "address" TEXT,
    "bookingId" TEXT,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ON_DELIVERY',
    "courierId" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "orderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "from" "OrderStatus",
    "to" "OrderStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PromoterStatus" NOT NULL DEFAULT 'PENDING',
    "payoutMethod" "PayoutMethod",
    "payoutName" TEXT,
    "payoutNumber" TEXT,
    "bankName" TEXT,
    "about" TEXT NOT NULL DEFAULT '',
    "statusReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoterVisit" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visitor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoterVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoterReward" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "promoterReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userPhoto" (
    "userId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userPhoto_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "restaurant_status_city_idx" ON "restaurant"("status", "city");

-- CreateIndex
CREATE INDEX "menuItem_restaurantId_position_idx" ON "menuItem"("restaurantId", "position");

-- CreateIndex
CREATE INDEX "restaurantMember_userId_idx" ON "restaurantMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurantMember_restaurantId_userId_key" ON "restaurantMember"("restaurantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "foodOrder_reference_key" ON "foodOrder"("reference");

-- CreateIndex
CREATE INDEX "foodOrder_restaurantId_createdAt_idx" ON "foodOrder"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "foodOrder_customerId_createdAt_idx" ON "foodOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "orderEvent_orderId_createdAt_idx" ON "orderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promoter_userId_key" ON "promoter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "promoter_code_key" ON "promoter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promoterVisit_promoterId_day_visitor_key" ON "promoterVisit"("promoterId", "day", "visitor");

-- CreateIndex
CREATE UNIQUE INDEX "promoterReward_bookingId_key" ON "promoterReward"("bookingId");

-- CreateIndex
CREATE INDEX "promoterReward_promoterId_status_idx" ON "promoterReward"("promoterId", "status");

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant" ADD CONSTRAINT "restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant" ADD CONSTRAINT "restaurant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menuItem" ADD CONSTRAINT "menuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurantMember" ADD CONSTRAINT "restaurantMember_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurantMember" ADD CONSTRAINT "restaurantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foodOrder" ADD CONSTRAINT "foodOrder_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foodOrder" ADD CONSTRAINT "foodOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderItem" ADD CONSTRAINT "orderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "foodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderEvent" ADD CONSTRAINT "orderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "foodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter" ADD CONSTRAINT "promoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoterVisit" ADD CONSTRAINT "promoterVisit_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoterReward" ADD CONSTRAINT "promoterReward_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoterReward" ADD CONSTRAINT "promoterReward_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userPhoto" ADD CONSTRAINT "userPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
