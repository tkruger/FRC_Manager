-- New items are filed under Uncategorized until someone sorts them
ALTER TABLE "BaseInventoryItem" ALTER COLUMN "category" SET DEFAULT 'UNCATEGORIZED';
