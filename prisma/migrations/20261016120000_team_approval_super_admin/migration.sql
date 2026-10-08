-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('PENDING', 'ACTIVE', 'DENIED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_APPROVAL_NEEDED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

