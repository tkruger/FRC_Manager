-- AlterTable
ALTER TABLE "OrderDraft" ADD COLUMN     "lastEditedById" TEXT;

-- CreateTable
CREATE TABLE "OrderDraftCollaborator" (
    "draftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDraftCollaborator_pkey" PRIMARY KEY ("draftId","userId")
);

-- CreateIndex
CREATE INDEX "OrderDraftCollaborator_userId_idx" ON "OrderDraftCollaborator"("userId");

-- CreateIndex
CREATE INDEX "OrderDraft_teamId_updatedAt_idx" ON "OrderDraft"("teamId", "updatedAt");

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraftCollaborator" ADD CONSTRAINT "OrderDraftCollaborator_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OrderDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraftCollaborator" ADD CONSTRAINT "OrderDraftCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

