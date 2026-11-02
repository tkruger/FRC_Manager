-- Head Mentor broadcast messages; Discord announcements channel
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BROADCAST';

-- AlterTable
ALTER TABLE "DiscordConfig" ADD COLUMN     "channelAnnouncements" TEXT;

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sentById" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "groups" TEXT[],
    "emailGroups" TEXT[],
    "discord" TEXT[],
    "counts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_teamId_createdAt_idx" ON "Broadcast"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

