export const AUTO_COLUMN_MAP: Record<string, string> = {
  "book id": "externalId",
  title: "title",
  "purchase price": "purchasePrice",
  "actual price": "marketPrice",
  author: "author",
  "additional authors": "additionalAuthors",
  isbn: "isbn",
  isbn13: "isbn13",
  publisher: "publisher",
  binding: "binding",
  "number of pages": "numberOfPages",
  "year published": "yearPublished",
  "original publication year": "originalPublicationYear",
};

export function detectColumnMapping(
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    mapping[header] = AUTO_COLUMN_MAP[key] ?? "";
  }
  return mapping;
}
