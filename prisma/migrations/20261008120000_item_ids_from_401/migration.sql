-- Order item IDs start at 0401, above the team's existing spreadsheet IDs.

-- New teams start at 401
ALTER TABLE "Team" ALTER COLUMN "nextOrderItemNumber" SET DEFAULT 401;

-- Existing items (none had been exported to the spreadsheet) move up by 400:
-- #0001 → #0401, #0014 → #0414
UPDATE "PurchaseLineItem" SET "orderNumber" = "orderNumber" + 400
WHERE "orderNumber" IS NOT NULL AND "orderNumber" <= 400;

-- Each team's next ID continues after its renumbered items (or 401 if it has none)
UPDATE "Team" SET "nextOrderItemNumber" = "nextOrderItemNumber" + 400
WHERE "nextOrderItemNumber" <= 400;
