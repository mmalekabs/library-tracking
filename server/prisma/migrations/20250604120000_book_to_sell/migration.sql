-- Add to-sell flag for books listed for sale
ALTER TABLE "Book" ADD COLUMN "toSell" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Book_toSell_idx" ON "Book"("toSell");
