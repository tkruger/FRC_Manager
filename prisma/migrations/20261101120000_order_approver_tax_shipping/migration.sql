-- Treasurer becomes Order approver (approves orders only). Renaming the enum value keeps
-- everyone's role (user roles and invites follow automatically).
ALTER TYPE "Role" RENAME VALUE 'TREASURER' TO 'ORDER_APPROVER';

-- The role's name inside JSON: saved purchase workflows (step roles and text) and order history
UPDATE "WorkflowDefinition"
SET "definition" = replace(replace(replace("definition"::text, '"TREASURER"', '"ORDER_APPROVER"'), 'Treasurers', 'Order approvers'), 'Treasurer', 'Order approver')::jsonb
WHERE "definition"::text LIKE '%TREASURER%' OR "definition"::text LIKE '%Treasurer%';

UPDATE "PurchaseRequestEvent"
SET "data" = replace("data"::text, '"TREASURER"', '"ORDER_APPROVER"')::jsonb
WHERE "data" IS NOT NULL AND "data"::text LIKE '%"TREASURER"%';

-- Shipping on orders gets its own budget category
ALTER TYPE "BudgetCategoryType" ADD VALUE 'SHIPPING';

-- Tax and shipping per vendor on an order
CREATE TABLE "OrderVendorCharge" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderVendorCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderVendorCharge_requestId_vendorName_key" ON "OrderVendorCharge"("requestId", "vendorName");

ALTER TABLE "OrderVendorCharge" ADD CONSTRAINT "OrderVendorCharge_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
