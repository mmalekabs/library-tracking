-- Drop bookshelf junction and tables first
DROP TABLE IF EXISTS "BookBookshelf";
DROP TABLE IF EXISTS "Bookshelf";

-- Drop reading-status and date columns from books
ALTER TABLE "Book" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "dateAdded";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "dateStartedReading";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "dateFinishedReading";

DROP TYPE IF EXISTS "ReadingStatus";

DROP INDEX IF EXISTS "Book_status_idx";
