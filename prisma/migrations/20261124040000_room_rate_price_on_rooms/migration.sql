-- Rooms carry their own prices; a category's stored price is only its cheapest room's (0 until a room has one).
ALTER TABLE "roomRate" DROP CONSTRAINT IF EXISTS "roomRate_price_positive";
ALTER TABLE "roomRate" ADD CONSTRAINT "roomRate_price_positive" CHECK ("price" >= 0);
