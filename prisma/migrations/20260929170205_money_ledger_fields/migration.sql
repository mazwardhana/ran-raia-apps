/*
  Warnings:

  - A unique constraint covering the columns `[secondaryListingId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SYSTEM';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'SECONDARY_BUY';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "secondaryListingId" TEXT;

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_secondaryListingId_key" ON "Transaction"("secondaryListingId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_secondaryListingId_fkey" FOREIGN KEY ("secondaryListingId") REFERENCES "SecondaryListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
