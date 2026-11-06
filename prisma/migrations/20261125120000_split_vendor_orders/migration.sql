-- DropIndex
DROP INDEX "OrderVendorCharge_requestId_vendorName_key";

-- AlterTable
ALTER TABLE "OrderVendorCharge" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PurchaseLineItem" ADD COLUMN     "vendorOrderId" TEXT;

-- CreateIndex
CREATE INDEX "OrderVendorCharge_requestId_vendorName_idx" ON "OrderVendorCharge"("requestId", "vendorName");

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "OrderVendorCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

