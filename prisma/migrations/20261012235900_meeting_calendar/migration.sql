-- The meetings calendar (meetings, meeting ↔ task links, per-day times, the iCal token)
-- was added to production without a migration, so a database built from migrations
-- alone was missing it. Written to be a no-op where it already exists (production) and
-- to create it everywhere else. Meeting."customTime" comes in the next migration.

-- AlterTable
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "meetingDayTimes" JSONB;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "calendarToken" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_MeetingTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingTasks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Season_calendarToken_key" ON "Season"("calendarToken");
CREATE INDEX IF NOT EXISTS "_MeetingTasks_B_index" ON "_MeetingTasks"("B");

-- AddForeignKey (only where missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_seasonId_fkey') THEN
    ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_MeetingTasks_A_fkey') THEN
    ALTER TABLE "_MeetingTasks" ADD CONSTRAINT "_MeetingTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_MeetingTasks_B_fkey') THEN
    ALTER TABLE "_MeetingTasks" ADD CONSTRAINT "_MeetingTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
