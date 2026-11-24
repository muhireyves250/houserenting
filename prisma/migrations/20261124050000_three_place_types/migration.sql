-- VIIPA lists three kinds of place: apartments, private houses and guest houses (lodges keep their room categories).
UPDATE "listing" SET "type" = 'GUEST_HOUSE' WHERE "type" = 'LODGE';
UPDATE "listing" SET "type" = 'APARTMENT' WHERE "type" = 'ROOM';
UPDATE "listing" SET "type" = 'PRIVATE_HOUSE' WHERE "type" IN ('OTHER', 'DUPLEX');
