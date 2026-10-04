-- CreateEnum
CREATE TYPE "WorkflowKind" AS ENUM ('PURCHASE');

-- AlterTable
ALTER TABLE "ReorderRequest" ADD COLUMN     "purchaseRequestId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "currentStepKey" TEXT,
ADD COLUMN     "workflowDefinitionId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepKey" TEXT,
    "stepName" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "kind" "WorkflowKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequestEvent_requestId_createdAt_idx" ON "PurchaseRequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_teamId_kind_version_key" ON "WorkflowDefinition"("teamId", "kind", "version");

-- AddForeignKey
ALTER TABLE "ReorderRequest" ADD CONSTRAINT "ReorderRequest_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestEvent" ADD CONSTRAINT "PurchaseRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestEvent" ADD CONSTRAINT "PurchaseRequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

