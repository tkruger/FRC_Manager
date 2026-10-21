-- A template task can count from another task in the same template (its due date)
ALTER TYPE "TaskAnchor" ADD VALUE 'TASK';

ALTER TABLE "TemplateTask" ADD COLUMN "anchorTaskName" TEXT;
