-- CreateEnum
CREATE TYPE "BookProgressMode" AS ENUM ('AUTO', 'PAGES', 'CHAPTERS', 'MINUTES', 'KINDLE_LOC');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN "progressMode" "BookProgressMode" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "Book" ADD COLUMN "numberOfChapters" INTEGER;
ALTER TABLE "Book" ADD COLUMN "kindleMaxLocation" INTEGER;
