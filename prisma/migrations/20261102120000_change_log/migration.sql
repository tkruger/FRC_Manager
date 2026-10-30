-- Change history for orders, tasks and meetings (who changed which field, from → to)
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChangeLog_teamId_createdAt_idx" ON "ChangeLog"("teamId", "createdAt");
CREATE INDEX "ChangeLog_entityType_entityId_createdAt_idx" ON "ChangeLog"("entityType", "entityId", "createdAt");

ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
