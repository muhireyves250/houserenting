-- Laundry: VIIPA accepts a request before the place's owner collects it; the guest confirms they received it.
ALTER TYPE "LaundryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED' AFTER 'REQUESTED';
ALTER TYPE "LaundryStatus" ADD VALUE IF NOT EXISTS 'RECEIVED' AFTER 'RETURNED';
