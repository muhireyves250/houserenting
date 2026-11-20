-- A promo code can be given to a promoter (optional): bookings using it count as theirs.
ALTER TABLE "promoCode" ADD COLUMN "promoterId" TEXT;
CREATE INDEX "promoCode_promoterId_idx" ON "promoCode"("promoterId");
ALTER TABLE "promoCode" ADD CONSTRAINT "promoCode_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
