-- Team email: send through the Gmail API (connected with Google) as well as SMTP
-- AlterTable
ALTER TABLE "TeamEmailServer" ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'smtp',
ADD COLUMN     "refreshTokenEnc" TEXT,
ALTER COLUMN "host" DROP NOT NULL,
ALTER COLUMN "port" DROP NOT NULL,
ALTER COLUMN "security" DROP NOT NULL,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "passwordEnc" DROP NOT NULL;

