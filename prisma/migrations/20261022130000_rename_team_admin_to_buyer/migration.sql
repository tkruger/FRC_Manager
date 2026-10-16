-- The Team Admin role is now Buyer, in the database too. Renaming the enum value keeps
-- everyone's role (user roles and invite roles use the enum, so they follow automatically).
ALTER TYPE "Role" RENAME VALUE 'TEAM_ADMIN' TO 'BUYER';

-- Role names also appear as text inside JSON: purchase workflow steps (who acts, who's
-- notified) and, possibly, order history details.
UPDATE "WorkflowDefinition"
SET "definition" = replace("definition"::text, '"TEAM_ADMIN"', '"BUYER"')::jsonb
WHERE "definition"::text LIKE '%"TEAM_ADMIN"%';

UPDATE "PurchaseRequestEvent"
SET "data" = replace("data"::text, '"TEAM_ADMIN"', '"BUYER"')::jsonb
WHERE "data" IS NOT NULL AND "data"::text LIKE '%"TEAM_ADMIN"%';
