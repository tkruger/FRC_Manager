-- Budget: money from the team's own account, and how much of a partial pledge has come in
ALTER TYPE "FundingType" ADD VALUE 'TEAM_ACCOUNT';
ALTER TABLE "FundingSource" ADD COLUMN "receivedAmount" DOUBLE PRECISION;
