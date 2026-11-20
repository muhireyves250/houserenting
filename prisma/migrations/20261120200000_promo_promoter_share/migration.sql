-- The promoter's share (basis points) of each booking that uses their promo code.
ALTER TABLE "promoCode" ADD COLUMN "promoterBps" INTEGER;
