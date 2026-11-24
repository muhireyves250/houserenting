-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "pendingChanges" JSONB,
ADD COLUMN     "pendingChangesAt" TIMESTAMP(3);

