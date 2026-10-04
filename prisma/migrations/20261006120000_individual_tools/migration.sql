-- Every physical tool becomes its own record (no more quantityOwned), so identical
-- tools (e.g. two drills) each keep their own condition, checkout and barcode.

ALTER TABLE "Team" ADD COLUMN "nextToolNumber" INTEGER NOT NULL DEFAULT 1;

-- 1. Split tools that had a quantity above 1 into individual copies (same name)
INSERT INTO "Tool" (
  "id", "teamId", "name", "toolType", "manufacturer", "model", "assetTag", "serialNumber",
  "homeLocation", "space", "condition", "requiresCertification", "certificationName",
  "lastMaintenanceDate", "nextMaintenanceDue", "maintenanceIntervalDays", "replacementCost",
  "image", "notes", "retired", "createdAt", "updatedAt"
)
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || t."id" || g.n::text), 1, 24),
  t."teamId", t."name", t."toolType", t."manufacturer", t."model",
  CASE WHEN t."assetTag" IS NOT NULL THEN t."assetTag" || '-' || g.n ELSE NULL END,
  NULL,
  t."homeLocation", t."space", t."condition", t."requiresCertification", t."certificationName",
  t."lastMaintenanceDate", t."nextMaintenanceDue", t."maintenanceIntervalDays", t."replacementCost",
  t."image", t."notes", t."retired", t."createdAt", CURRENT_TIMESTAMP
FROM "Tool" t
CROSS JOIN LATERAL generate_series(2, t."quantityOwned") AS g(n)
WHERE t."quantityOwned" > 1;

-- The original keeps copy #1's tag
UPDATE "Tool" SET "assetTag" = "assetTag" || '-1'
WHERE "quantityOwned" > 1 AND "assetTag" IS NOT NULL;

-- 2. Give every untagged tool its own tag: TOOL-0001, TOOL-0002, … per team
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "teamId" ORDER BY "name", "createdAt", "id") AS n
  FROM "Tool" WHERE "assetTag" IS NULL
)
UPDATE "Tool" t SET "assetTag" = 'TOOL-' || lpad(numbered.n::text, 4, '0')
FROM numbered WHERE t."id" = numbered."id";

UPDATE "Team" tm SET "nextToolNumber" = 1 + COALESCE((
  SELECT max(substring("assetTag" from '^TOOL-(\d+)$')::int) FROM "Tool"
  WHERE "teamId" = tm."id" AND "assetTag" ~ '^TOOL-\d+$'
), 0);

-- 3. Quantities no longer exist: each checkout is one tool
ALTER TABLE "Tool" DROP COLUMN "quantityOwned";
ALTER TABLE "ToolCheckout" DROP COLUMN "quantity";
