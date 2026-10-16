-- The Budget Manager role is now Treasurer, in the database too. Renaming the enum value
-- keeps everyone's role (user roles and invite roles follow automatically).
ALTER TYPE "Role" RENAME VALUE 'BUDGET_MANAGER' TO 'TREASURER';

-- Role names inside JSON: purchase workflow steps, and possibly order history details.
-- Saved workflows may also use the old name in step text.
UPDATE "WorkflowDefinition"
SET "definition" = replace(replace(replace("definition"::text, '"BUDGET_MANAGER"', '"TREASURER"'), 'Budget Managers', 'Treasurers'), 'Budget Manager', 'Treasurer')::jsonb
WHERE "definition"::text LIKE '%BUDGET_MANAGER%' OR "definition"::text LIKE '%Budget Manager%';

UPDATE "PurchaseRequestEvent"
SET "data" = replace("data"::text, '"BUDGET_MANAGER"', '"TREASURER"')::jsonb
WHERE "data" IS NOT NULL AND "data"::text LIKE '%"BUDGET_MANAGER"%';
