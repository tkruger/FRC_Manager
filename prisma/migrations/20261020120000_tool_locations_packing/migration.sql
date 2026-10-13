-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "nextLocationNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ToolLocation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackListItem" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "toolName" TEXT,
    "label" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolId" TEXT,
    "itemId" TEXT,
    "locationId" TEXT,
    "packedById" TEXT,
    "packedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToolLocation_teamId_code_key" ON "ToolLocation"("teamId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ToolLocation_teamId_name_key" ON "ToolLocation"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PackEntry_sessionId_toolId_key" ON "PackEntry"("sessionId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "PackEntry_sessionId_itemId_key" ON "PackEntry"("sessionId", "itemId");

-- AddForeignKey
ALTER TABLE "ToolLocation" ADD CONSTRAINT "ToolLocation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackListItem" ADD CONSTRAINT "PackListItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackSession" ADD CONSTRAINT "PackSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackSession" ADD CONSTRAINT "PackSession_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "CompetitionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackSession" ADD CONSTRAINT "PackSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackEntry" ADD CONSTRAINT "PackEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackEntry" ADD CONSTRAINT "PackEntry_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackEntry" ADD CONSTRAINT "PackEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PackListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackEntry" ADD CONSTRAINT "PackEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ToolLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackEntry" ADD CONSTRAINT "PackEntry_packedById_fkey" FOREIGN KEY ("packedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

