-- Seasons run from a start (kickoff) to an end date; Week 0 now comes from competitions.

-- AlterEnum
ALTER TYPE "TaskAnchor" ADD VALUE 'SEASON_END';

-- End date: the later of the old Week 0 date and the season's last competition
ALTER TABLE "Season" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "Season" s SET "endDate" = GREATEST(
  s."week0Date",
  COALESCE((SELECT MAX(e."endDate") FROM "CompetitionEvent" e WHERE e."seasonId" = s.id), s."week0Date")
);
ALTER TABLE "Season" ALTER COLUMN "endDate" SET NOT NULL;

-- Week 0 date is no longer used (kept nullable until a later cleanup drops it)
ALTER TABLE "Season" ALTER COLUMN "week0Date" DROP NOT NULL;
