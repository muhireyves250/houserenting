-- Food orders: the restaurant confirms first (5 minutes), then the customer pays; delivery person; feedback.
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'COURIER_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE 'FINISHED';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'TIMED_OUT';
ALTER TABLE "foodOrder" ADD COLUMN "rating" INTEGER, ADD COLUMN "feedback" TEXT;
