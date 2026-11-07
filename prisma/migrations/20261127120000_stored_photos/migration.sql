-- CreateTable
CREATE TABLE "StoredPhoto" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredPhoto_teamId_createdAt_idx" ON "StoredPhoto"("teamId", "createdAt");

