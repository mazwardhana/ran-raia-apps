-- DropIndex
DROP INDEX "LotOwnership_packageId_userId_key";

-- CreateIndex
CREATE INDEX "LotOwnership_packageId_userId_idx" ON "LotOwnership"("packageId", "userId");
