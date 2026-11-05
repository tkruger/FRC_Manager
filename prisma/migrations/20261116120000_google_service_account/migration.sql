-- Team email: Google Workspace service account; per-team sending limits
-- AlterTable
ALTER TABLE "TeamEmailServer" ADD COLUMN     "dailyLimit" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "hourlyLimit" INTEGER NOT NULL DEFAULT 250,
ADD COLUMN     "serviceAccountEmail" TEXT,
ADD COLUMN     "serviceKeyEnc" TEXT;

