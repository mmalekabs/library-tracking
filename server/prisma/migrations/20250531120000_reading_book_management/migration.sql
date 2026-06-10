-- To-read ordering, planned start, series, archive flag
ALTER TABLE "Book" ADD COLUMN "toReadSortOrder" INTEGER;
ALTER TABLE "Book" ADD COLUMN "plannedStartDate" DATE;
ALTER TABLE "Book" ADD COLUMN "seriesName" TEXT;
ALTER TABLE "Book" ADD COLUMN "seriesPosition" INTEGER;
ALTER TABLE "Book" ADD COLUMN "readingArchived" BOOLEAN NOT NULL DEFAULT false;

-- Per-entry tags
ALTER TABLE "ReadingEntry" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Book_readingArchived_idx" ON "Book"("readingArchived");
CREATE INDEX "Book_toReadSortOrder_idx" ON "Book"("toReadSortOrder");
