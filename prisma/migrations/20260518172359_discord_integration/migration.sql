-- CreateTable
CREATE TABLE "DiscordConfig" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "channelBuildAlerts" TEXT,
    "channelOrders" TEXT,
    "channelInventory" TEXT,
    "channelTasks" TEXT,
    "channelSafety" TEXT,
    "channelGeneral" TEXT,
    "channelMilestones" TEXT,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySummaryChannel" TEXT,
    "dailySummaryTime" TEXT NOT NULL DEFAULT '08:00',
    "publicReadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT,
    "revokedAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordInteractionLog" (
    "id" TEXT NOT NULL,
    "configId" TEXT,
    "discordUserId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "params" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordInteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordConfig_teamId_key" ON "DiscordConfig"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_userId_key" ON "DiscordLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_discordUserId_key" ON "DiscordLink"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLinkToken_token_key" ON "DiscordLinkToken"("token");

-- AddForeignKey
ALTER TABLE "DiscordConfig" ADD CONSTRAINT "DiscordConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordLink" ADD CONSTRAINT "DiscordLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordInteractionLog" ADD CONSTRAINT "DiscordInteractionLog_configId_fkey" FOREIGN KEY ("configId") REFERENCES "DiscordConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
