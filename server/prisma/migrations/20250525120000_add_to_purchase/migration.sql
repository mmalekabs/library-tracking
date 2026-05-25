-- AlterTable
ALTER TABLE "Book" ADD COLUMN "toPurchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Book_toPurchase_idx" ON "Book"("toPurchase");
