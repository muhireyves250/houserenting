-- Managers: VIIPA staff for the services they are given (laundry, food, bookings…). Admins keep everything.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER' AFTER 'USER';
