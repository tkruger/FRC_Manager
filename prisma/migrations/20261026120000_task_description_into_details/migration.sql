-- Tasks and template tasks keep one text field: Details (Markdown). Any description moves
-- to the top of the details, so nothing is lost, then the column goes.
UPDATE "Task"
SET "details" = CASE
  WHEN "details" IS NULL OR btrim("details") = '' THEN "description"
  ELSE "description" || E'\n\n' || "details"
END
WHERE "description" IS NOT NULL AND btrim("description") <> '';

UPDATE "TemplateTask"
SET "details" = CASE
  WHEN "details" IS NULL OR btrim("details") = '' THEN "description"
  ELSE "description" || E'\n\n' || "details"
END
WHERE "description" IS NOT NULL AND btrim("description") <> '';

ALTER TABLE "Task" DROP COLUMN "description";
ALTER TABLE "TemplateTask" DROP COLUMN "description";
