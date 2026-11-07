-- AlterEnum
ALTER TYPE "UnitOfMeasure" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "BaseInventoryItem" ADD COLUMN     "amountLeft" TEXT,
ADD COLUMN     "stockTag" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "nextStockNumber" INTEGER NOT NULL DEFAULT 1;


-- Existing items get their label codes (INV-0001, … per team, oldest first), and each team's counter
-- continues after them
UPDATE "BaseInventoryItem" AS b
SET "stockTag" = 'INV-' || lpad(x.n::text, 4, '0')
FROM (
  SELECT bi."id", row_number() OVER (PARTITION BY s."teamId" ORDER BY bi."createdAt", bi."id") AS n
  FROM "BaseInventoryItem" bi
  JOIN "Season" s ON s."id" = bi."seasonId"
) AS x
WHERE x."id" = b."id";

UPDATE "Team" AS t
SET "nextStockNumber" = 1 + (
  SELECT count(*) FROM "BaseInventoryItem" bi JOIN "Season" s ON s."id" = bi."seasonId" WHERE s."teamId" = t."id"
);
