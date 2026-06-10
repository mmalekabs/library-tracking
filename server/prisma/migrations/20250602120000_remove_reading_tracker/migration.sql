-- Remove reading tracker tables and book columns

DELETE FROM "Book" WHERE "readingOnly" = true;

DROP TABLE IF EXISTS "ReadingSession";
DROP TABLE IF EXISTS "ReadingEntry";
DROP TABLE IF EXISTS "ReadingGoalSettings";

ALTER TABLE "Book" DROP COLUMN IF EXISTS "readingOnly";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "readingArchived";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "toReadSortOrder";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "plannedStartDate";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "seriesName";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "seriesPosition";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "progressMode";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "numberOfChapters";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "kindleMaxLocation";

DROP TYPE IF EXISTS "BookProgressMode";

DROP INDEX IF EXISTS "Book_readingOnly_idx";
