-- Package tracking (Track123): a tracking number on each shipment, its status, and the team's key
ALTER TABLE "Tracking" ALTER COLUMN "url" DROP NOT NULL;
ALTER TABLE "Tracking" ADD COLUMN "number" TEXT,
ADD COLUMN "carrier" TEXT,
ADD COLUMN "carrierName" TEXT,
ADD COLUMN "status" TEXT,
ADD COLUMN "statusDetail" TEXT,
ADD COLUMN "expectedDelivery" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "deliveredNotifiedAt" TIMESTAMP(3),
ADD COLUMN "registeredAt" TIMESTAMP(3),
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "trackError" TEXT;

-- CreateIndex
CREATE INDEX "Tracking_registeredAt_deliveredAt_idx" ON "Tracking"("registeredAt", "deliveredAt");

ALTER TABLE "TeamVendorKeys" ADD COLUMN "track123KeyEnc" TEXT;
