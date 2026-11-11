-- Food orders: paid by mobile money before the kitchen starts; customers can remove cancelled orders from their list.
ALTER TABLE "foodOrder" ADD COLUMN "paymentClaim" TEXT;
ALTER TABLE "foodOrder" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "foodOrder" ADD COLUMN "paidReference" TEXT;
ALTER TABLE "foodOrder" ADD COLUMN "hiddenByCustomer" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "foodOrder_paidReference_key" ON "foodOrder"("paidReference");
