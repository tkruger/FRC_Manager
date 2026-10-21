-- Tasks scheduled from their prerequisites: start = last prerequisite due + lagDays,
-- due = start + durationDays
ALTER TABLE "Task" ADD COLUMN "autoSchedule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "Task" ADD COLUMN "lagDays" INTEGER NOT NULL DEFAULT 0;
