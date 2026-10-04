-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('QUEUED', 'TO_ORDER', 'ORDERED', 'ARRIVED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEAM_ADMIN';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "nextOrderItemNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PurchaseLineItem" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "arrivedById" TEXT,
ADD COLUMN     "exportedAt" TIMESTAMP(3),
ADD COLUMN     "importance" "RequestPriority" NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderNumber" INTEGER,
ADD COLUMN     "orderedAt" TIMESTAMP(3),
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "subTeam" "SubTeam",
ADD COLUMN     "trackingId" TEXT,
ADD COLUMN     "vendorName" TEXT;

-- CreateTable
CREATE TABLE "Tracking" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tracking_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "Tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tracking" ADD CONSTRAINT "Tracking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Backfill: existing request lines become order items ────────────────────
-- Copy order-level details down to each item
UPDATE "PurchaseLineItem" li SET
  "vendorName" = v."name",
  "subTeam"    = pr."subTeam",
  "importance" = pr."priority",
  "reasoning"  = pr."justification",
  "status" = (CASE pr."status"
                WHEN 'APPROVED'         THEN 'TO_ORDER'
                WHEN 'ORDERED'          THEN 'ORDERED'
                WHEN 'PARTIAL_RECEIVED' THEN 'ORDERED'
                WHEN 'RECEIVED'         THEN 'ARRIVED'
                ELSE 'QUEUED'
              END)::"OrderItemStatus",
  "orderedAt" = CASE WHEN pr."status" IN ('ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED') THEN pr."orderDate" END,
  "arrivedAt" = CASE WHEN pr."status" = 'RECEIVED' THEN pr."receivedDate" END
FROM "PurchaseRequest" pr
LEFT JOIN "Vendor" v ON v."id" = pr."preferredVendorId"
WHERE pr."id" = li."requestId";

-- Sequential item IDs per team, oldest first
WITH numbered AS (
  SELECT li."id", row_number() OVER (PARTITION BY s."teamId" ORDER BY pr."submittedAt", li."id") AS n
  FROM "PurchaseLineItem" li
  JOIN "PurchaseRequest" pr ON pr."id" = li."requestId"
  JOIN "Season" s ON s."id" = pr."seasonId"
)
UPDATE "PurchaseLineItem" li SET "orderNumber" = numbered.n FROM numbered WHERE li."id" = numbered."id";

UPDATE "Team" t SET "nextOrderItemNumber" = 1 + COALESCE((
  SELECT max(li."orderNumber") FROM "PurchaseLineItem" li
  JOIN "PurchaseRequest" pr ON pr."id" = li."requestId"
  JOIN "Season" s ON s."id" = pr."seasonId"
  WHERE s."teamId" = t."id"
), 0);
