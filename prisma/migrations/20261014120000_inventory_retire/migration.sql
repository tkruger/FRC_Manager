-- AlterTable
ALTER TABLE "BaseInventoryItem" ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "retiredById" TEXT;

-- AddForeignKey
ALTER TABLE "BaseInventoryItem" ADD CONSTRAINT "BaseInventoryItem_retiredById_fkey" FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

