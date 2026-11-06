-- CreateTable
CREATE TABLE "TeamVendorKeys" (
    "teamId" TEXT NOT NULL,
    "mouserKeyEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamVendorKeys_pkey" PRIMARY KEY ("teamId")
);

-- AddForeignKey
ALTER TABLE "TeamVendorKeys" ADD CONSTRAINT "TeamVendorKeys_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

