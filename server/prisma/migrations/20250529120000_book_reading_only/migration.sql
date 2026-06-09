-- AlterTable
ALTER TABLE "Book" ADD COLUMN "readingOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Book_readingOnly_idx" ON "Book"("readingOnly");
