-- CreateEnum
CREATE TYPE "RentalMode" AS ENUM ('STAY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('GUEST_PAYMENT', 'GUEST_FEE', 'COMMISSION', 'HOST_PAYABLE', 'DEPOSIT_HELD', 'PROMO_DISCOUNT', 'SETTLEMENT', 'REFERRAL_REWARD', 'REFUND');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PromoFunding" AS ENUM ('PLATFORM', 'HOST');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'APPROVED', 'VOID');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "deposit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "months" INTEGER,
ADD COLUMN     "promoCodeId" TEXT,
ADD COLUMN     "rentalMode" "RentalMode" NOT NULL DEFAULT 'STAY',
ADD COLUMN     "upfrontMonths" INTEGER;

-- AlterTable
ALTER TABLE "platformConfig" ADD COLUMN     "monthlyUpfrontMonths" INTEGER,
ADD COLUMN     "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralRewardAmount" INTEGER;

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgerEntry" (
    "id" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "bookingId" TEXT,
    "hostId" TEXT,
    "settlementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" "SettlementStatus" NOT NULL DEFAULT 'PAID',
    "method" TEXT,
    "externalReference" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "percentOff" INTEGER,
    "amountOff" INTEGER,
    "minSubtotal" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "fundedBy" "PromoFunding" NOT NULL DEFAULT 'PLATFORM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "referralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerReference_key" ON "payment"("providerReference");

-- CreateIndex
CREATE INDEX "payment_bookingId_idx" ON "payment"("bookingId");

-- CreateIndex
CREATE INDEX "ledgerEntry_hostId_kind_idx" ON "ledgerEntry"("hostId", "kind");

-- CreateIndex
CREATE INDEX "ledgerEntry_bookingId_idx" ON "ledgerEntry"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_reference_key" ON "settlement"("reference");

-- CreateIndex
CREATE INDEX "settlement_hostId_createdAt_idx" ON "settlement"("hostId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promoCode_code_key" ON "promoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referralReward_refereeId_key" ON "referralReward"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "referralReward_bookingId_key" ON "referralReward"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "user_referralCode_key" ON "user"("referralCode");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgerEntry" ADD CONSTRAINT "ledgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgerEntry" ADD CONSTRAINT "ledgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referralReward" ADD CONSTRAINT "referralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referralReward" ADD CONSTRAINT "referralReward_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referralReward" ADD CONSTRAINT "referralReward_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ledgerEntry" ADD CONSTRAINT "ledgerEntry_positive" CHECK ("amount" >= 0);
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_positive" CHECK ("amount" > 0);
ALTER TABLE "promoCode" ADD CONSTRAINT "promoCode_values" CHECK (
    ("percentOff" IS NULL OR "percentOff" BETWEEN 1 AND 100) AND ("amountOff" IS NULL OR "amountOff" > 0) AND ("percentOff" IS NOT NULL OR "amountOff" IS NOT NULL)
);
ALTER TABLE "booking" ADD CONSTRAINT "booking_money_nonnegative" CHECK ("discount" >= 0 AND "deposit" >= 0);
