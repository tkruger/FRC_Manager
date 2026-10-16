-- "Team Admin" is now called "Buyer" (the role stays TEAM_ADMIN in the database).
-- Saved purchase workflows carry the old name in their step names and descriptions.
UPDATE "WorkflowDefinition"
SET "definition" = replace(replace("definition"::text, 'Team Admins', 'Buyers'), 'Team Admin', 'Buyer')::jsonb
WHERE "definition"::text LIKE '%Team Admin%';
