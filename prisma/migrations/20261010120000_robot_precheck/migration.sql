-- CreateEnum
CREATE TYPE "PrecheckStatus" AS ENUM ('COMPLETE', 'NEEDS_WORK', 'INCOMPLETE');

-- AlterTable
ALTER TABLE "Robot" ADD COLUMN     "precheckStatus" "PrecheckStatus" NOT NULL DEFAULT 'INCOMPLETE',
ADD COLUMN     "precheckUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "precheckUpdatedById" TEXT,
ADD COLUMN     "precheckUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_precheckUpdatedById_fkey" FOREIGN KEY ("precheckUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

