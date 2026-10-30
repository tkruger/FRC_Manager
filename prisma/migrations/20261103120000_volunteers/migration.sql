-- Volunteer management: Parent and Volunteer Coordinator roles, volunteer clearance,
-- meeting volunteer shifts and instructions, and email as a notification channel

-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterEnum


ALTER TYPE "NotificationType" ADD VALUE 'VOLUNTEER_SHIFT';
ALTER TYPE "NotificationType" ADD VALUE 'VOLUNTEER_COVERAGE';

-- AlterEnum


ALTER TYPE "Role" ADD VALUE 'PARENT';
ALTER TYPE "Role" ADD VALUE 'VOLUNTEER_COORDINATOR';

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "email" BOOLEAN;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "volunteerClearedAt" TIMESTAMP(3),
ADD COLUMN     "volunteerClearedById" TEXT,
ADD COLUMN     "volunteerClearedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VolunteerSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "instructions" TEXT,
    "minAdults" INTEGER NOT NULL DEFAULT 2,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingVolunteer" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'CONFIRMED',
    "assignedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingVolunteerNote" (
    "meetingId" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingVolunteerNote_pkey" PRIMARY KEY ("meetingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSettings_teamId_key" ON "VolunteerSettings"("teamId");

-- CreateIndex
CREATE INDEX "MeetingVolunteer_userId_idx" ON "MeetingVolunteer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingVolunteer_meetingId_userId_key" ON "MeetingVolunteer"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "VolunteerSettings" ADD CONSTRAINT "VolunteerSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVolunteer" ADD CONSTRAINT "MeetingVolunteer_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVolunteer" ADD CONSTRAINT "MeetingVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVolunteer" ADD CONSTRAINT "MeetingVolunteer_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVolunteerNote" ADD CONSTRAINT "MeetingVolunteerNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

