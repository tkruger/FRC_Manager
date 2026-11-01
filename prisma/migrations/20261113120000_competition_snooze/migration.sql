-- Snooze competition alerts (no push or email until then)
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "competitionSnoozeUntil" TIMESTAMP(3);

