-- Only restaurant owners set up restaurants: people on a restaurant's team (managers, delivery) who own none lose the flag.
UPDATE "user" SET "isRestaurateur" = false
WHERE "isRestaurateur" = true
  AND "id" IN (SELECT "userId" FROM "restaurantMember")
  AND "id" NOT IN (SELECT "ownerId" FROM "restaurant");
