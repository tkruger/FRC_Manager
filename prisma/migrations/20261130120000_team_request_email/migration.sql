-- New teams: when the Head Mentor check email was last sent to whoever registered the team, and how many times
ALTER TABLE "Team" ADD COLUMN "headMentorCheckSentAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "headMentorCheckSentCount" INTEGER NOT NULL DEFAULT 0;
