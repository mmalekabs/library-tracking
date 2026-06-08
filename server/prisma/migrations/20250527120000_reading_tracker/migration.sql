-- CreateTable
CREATE TABLE "ReadingEntry" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" "ReadingStatus" NOT NULL DEFAULT 'READING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "currentPage" INTEGER,
    "rating" INTEGER,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "minutesRead" INTEGER,
    "endPage" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingEntry_bookId_idx" ON "ReadingEntry"("bookId");

-- CreateIndex
CREATE INDEX "ReadingEntry_status_idx" ON "ReadingEntry"("status");

-- CreateIndex
CREATE INDEX "ReadingEntry_startedAt_idx" ON "ReadingEntry"("startedAt");

-- CreateIndex
CREATE INDEX "ReadingEntry_finishedAt_idx" ON "ReadingEntry"("finishedAt");

-- CreateIndex
CREATE INDEX "ReadingSession_entryId_idx" ON "ReadingSession"("entryId");

-- CreateIndex
CREATE INDEX "ReadingSession_sessionDate_idx" ON "ReadingSession"("sessionDate");

-- AddForeignKey
ALTER TABLE "ReadingEntry" ADD CONSTRAINT "ReadingEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ReadingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing book reading data into ReadingEntry (library books only)
INSERT INTO "ReadingEntry" ("id", "bookId", "status", "startedAt", "finishedAt", "currentPage", "createdAt", "updatedAt")
SELECT
    'legacy-' || b."id",
    b."id",
    b."status",
    COALESCE(b."dateStartedReading", b."dateFinishedReading", b."dateAdded"),
    CASE WHEN b."status" IN ('READ', 'DID_NOT_FINISH') THEN b."dateFinishedReading" ELSE NULL END,
    NULL,
    b."createdAt",
    NOW()
FROM "Book" b
WHERE b."toPurchase" = false
  AND b."status" IN ('READING', 'READ', 'DID_NOT_FINISH', 'ON_HOLD');
