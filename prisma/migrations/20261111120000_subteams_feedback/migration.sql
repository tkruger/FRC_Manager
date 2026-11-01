-- Members in any number of sub-teams; meetings for one sub-team; meeting-start task and feedback notifications
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MEETING_TASKS';
ALTER TYPE "NotificationType" ADD VALUE 'FEEDBACK';
-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "subTeam" "SubTeam";
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subTeams" "SubTeam"[] DEFAULT ARRAY[]::"SubTeam"[];
