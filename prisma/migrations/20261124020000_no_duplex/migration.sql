-- Duplex is no longer a type of place: existing duplexes become private houses (the enum value stays, unused).
UPDATE "listing" SET "type" = 'PRIVATE_HOUSE' WHERE "type" = 'DUPLEX';
