
-- CreateTable
CREATE TABLE "placeRestaurant" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placeRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placeRestaurant_restaurantId_idx" ON "placeRestaurant"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "placeRestaurant_listingId_restaurantId_key" ON "placeRestaurant"("listingId", "restaurantId");

-- AddForeignKey
ALTER TABLE "placeRestaurant" ADD CONSTRAINT "placeRestaurant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placeRestaurant" ADD CONSTRAINT "placeRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Carry over each restaurant's place (the older single link).
INSERT INTO "placeRestaurant" ("id", "listingId", "restaurantId", "createdAt")
SELECT 'pr_' || "id", "listingId", "id", CURRENT_TIMESTAMP FROM "restaurant" WHERE "listingId" IS NOT NULL
ON CONFLICT DO NOTHING;
