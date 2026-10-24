-- A season's start and the FRC kickoff are separate dates. What was "kickoffDate" has
-- always been the season's first day, so it becomes "startDate" (data kept as is); the new
-- "kickoffDate" is the game kickoff, empty until set (the start date is used until then).
ALTER TABLE "Season" RENAME COLUMN "kickoffDate" TO "startDate";
ALTER TABLE "Season" ADD COLUMN "kickoffDate" TIMESTAMP(3);
