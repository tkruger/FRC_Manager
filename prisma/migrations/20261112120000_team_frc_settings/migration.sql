-- Each team's own The Blue Alliance / Nexus keys and webhook addresses
-- CreateTable
CREATE TABLE "TeamFrcSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "tbaKeyEnc" TEXT,
    "tbaWebhookSecretEnc" TEXT,
    "tbaVerificationCode" TEXT,
    "nexusKeyEnc" TEXT,
    "nexusWebhookTokenEnc" TEXT,
    "lastWebhookAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamFrcSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamFrcSettings_teamId_key" ON "TeamFrcSettings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamFrcSettings_hookId_key" ON "TeamFrcSettings"("hookId");

-- AddForeignKey
ALTER TABLE "TeamFrcSettings" ADD CONSTRAINT "TeamFrcSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

