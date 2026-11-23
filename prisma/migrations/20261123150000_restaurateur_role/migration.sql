-- The restaurant owner/manager role, given by VIIPA (restaurant owners so far get it too).
ALTER TABLE "user" ADD COLUMN "isRestaurateur" BOOLEAN NOT NULL DEFAULT false;
UPDATE "user" SET "isRestaurateur" = true WHERE "id" IN (SELECT "ownerId" FROM "restaurant") AND "role" = 'USER';
