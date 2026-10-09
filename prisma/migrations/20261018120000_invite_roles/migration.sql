-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY['TEAM_MEMBER']::"Role"[];

