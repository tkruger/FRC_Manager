-- CreateEnum
CREATE TYPE "CompetitionStage" AS ENUM ('PRACTICE', 'WEEK', 'PLAYOFF', 'WORLDS', 'OFFSEASON');

-- CreateEnum
CREATE TYPE "TaskAnchor" AS ENUM ('KICKOFF', 'SEASON_WEEK0', 'PRACTICE', 'WEEK', 'PLAYOFF', 'WORLDS', 'OFFSEASON');

-- AlterTable
ALTER TABLE "CompetitionEvent" ADD COLUMN     "stage" "CompetitionStage" NOT NULL DEFAULT 'WEEK',
ADD COLUMN     "stageNumber" INTEGER;

-- AlterTable
ALTER TABLE "TemplateTask" ADD COLUMN     "anchor" "TaskAnchor" NOT NULL DEFAULT 'KICKOFF',
ADD COLUMN     "anchorNumber" INTEGER;


-- Existing template tasks: positive offsets counted from kickoff, negative from Week 0
UPDATE "TemplateTask" SET "anchor" = 'SEASON_WEEK0' WHERE "startOffset" < 0;

-- Existing competitions: infer the stage from the event type
UPDATE "CompetitionEvent" SET "stage" = 'WEEK', "stageNumber" = 0 WHERE "eventType" = 'WEEK_0';
UPDATE "CompetitionEvent" SET "stage" = 'WORLDS' WHERE "eventType" = 'CHAMPIONSHIP';
UPDATE "CompetitionEvent" SET "stage" = 'PLAYOFF' WHERE "eventType" = 'DISTRICT_CHAMPIONSHIP';
UPDATE "CompetitionEvent" SET "stage" = 'OFFSEASON' WHERE "eventType" = 'OFFSEASON';
