-- Task lengths now count both ends: a task taking N days is due on start + N - 1 (it was
-- start + N). Keep every due date and length people entered by starting such tasks a day
-- later. Milestones (length 0) don't change.
UPDATE "TemplateTask" SET "startOffset" = "startOffset" + 1 WHERE "durationBuildDays" >= 1;

-- Tasks scheduled after their prerequisites: same idea, one more day after the last one
UPDATE "Task" SET "lagDays" = "lagDays" + 1
WHERE "autoSchedule" AND NOT "isMilestone";
