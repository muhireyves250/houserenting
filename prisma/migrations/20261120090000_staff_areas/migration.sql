-- What each staff member may manage. Admins who exist today keep everything they could already do.
ALTER TABLE "user" ADD COLUMN "staffAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "user" SET "staffAreas" = ARRAY['listings', 'bookings', 'messages', 'food', 'laundry', 'support', 'money', 'promotions', 'settings']::TEXT[] WHERE "role" = 'ADMIN';
