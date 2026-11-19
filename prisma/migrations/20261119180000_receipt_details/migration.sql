-- What staff print on guests' receipts: the business's details and a closing note (all optional).
ALTER TABLE "platformConfig" ADD COLUMN "receiptBusinessName" TEXT;
ALTER TABLE "platformConfig" ADD COLUMN "receiptAddress" TEXT;
ALTER TABLE "platformConfig" ADD COLUMN "receiptPhone" TEXT;
ALTER TABLE "platformConfig" ADD COLUMN "receiptEmail" TEXT;
ALTER TABLE "platformConfig" ADD COLUMN "receiptTin" TEXT;
ALTER TABLE "platformConfig" ADD COLUMN "receiptFooter" TEXT;
