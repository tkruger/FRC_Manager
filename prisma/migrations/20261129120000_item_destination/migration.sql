-- Where an order item goes when it arrives: nowhere (the new default), inventory or tools
CREATE TYPE "ItemDestination" AS ENUM ('NONE', 'INVENTORY', 'TOOLS');

ALTER TABLE "PurchaseLineItem" ADD COLUMN "destination" "ItemDestination" NOT NULL DEFAULT 'NONE';

-- Items already on orders were going to inventory when they arrived (and arrived ones went there): keep that
UPDATE "PurchaseLineItem" SET "destination" = 'INVENTORY';
