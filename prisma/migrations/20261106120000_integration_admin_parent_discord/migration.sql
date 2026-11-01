-- Integration admin role; a team can connect a student and a parent Discord server (existing ones are the student server)

-- CreateEnum
CREATE TYPE "DiscordAudience" AS ENUM ('STUDENT', 'PARENT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INTEGRATION_ADMIN';

-- DropIndex
DROP INDEX "DiscordConfig_teamId_key";

-- AlterTable
ALTER TABLE "DiscordConfig" ADD COLUMN     "audience" "DiscordAudience" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "channelVolunteers" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DiscordConfig_teamId_audience_key" ON "DiscordConfig"("teamId", "audience");

