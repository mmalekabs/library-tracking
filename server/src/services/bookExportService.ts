import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma.js";
import { calculateSavings, decimalToNumber } from "../utils/book.js";
import { bookInclude } from "./bookService.js";

export type BookExportCollection = "library" | "to_purchase" | "to_sell";

const EXPORT_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "Book Id", key: "externalId", width: 14 },
  { header: "Title", key: "title", width: 36 },
  { header: "Author", key: "author", width: 22 },
  { header: "Additional Authors", key: "additionalAuthors", width: 24 },
  { header: "ISBN", key: "isbn", width: 16 },
  { header: "ISBN13", key: "isbn13", width: 16 },
  { header: "Publisher", key: "publisher", width: 22 },
  { header: "Format", key: "format", width: 12 },
  { header: "Binding", key: "binding", width: 18 },
  { header: "Number of Pages", key: "numberOfPages", width: 14 },
  { header: "Year Published", key: "yearPublished", width: 14 },
  { header: "Original Publication Year", key: "originalPublicationYear", width: 22 },
  { header: "Purchase Price", key: "purchasePrice", width: 14 },
  { header: "Market Price", key: "marketPrice", width: 14 },
  { header: "Savings", key: "savings", width: 10 },
  { header: "Currency", key: "currency", width: 10 },
  { header: "Gift", key: "isGift", width: 8 },
  { header: "Publicly Visible", key: "isPubliclyVisible", width: 14 },
  { header: "To Sell", key: "toSell", width: 10 },
  { header: "Edition", key: "edition", width: 16 },
  { header: "Cover Image URL", key: "coverImageUrl", width: 40 },
  { header: "Notes", key: "notes", width: 32 },
  { header: "Created At", key: "createdAt", width: 22 },
];

function exportFilename(collection: BookExportCollection): string {
  const date = new Date().toISOString().slice(0, 10);
  const prefix =
    collection === "library"
      ? "library-books"
      : collection === "to_purchase"
        ? "to-purchase-books"
        : "to-sell-books";
  return `${prefix}-${date}.xlsx`;
}

export async function exportBooksToXlsx(
  collection: BookExportCollection,
): Promise<{ buffer: Buffer; filename: string }> {
  const where =
    collection === "to_purchase"
      ? { toPurchase: true }
      : collection === "to_sell"
        ? { toSell: true }
        : { toPurchase: false };

  const books = await prisma.book.findMany({
    where,
    include: bookInclude,
    orderBy: [{ title: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Personal Library Tracker";
  workbook.created = new Date();

  const sheetName =
    collection === "library"
      ? "Library"
      : collection === "to_purchase"
        ? "To Purchase"
        : "To Sell";
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  for (const book of books) {
    const savings = calculateSavings(book.purchasePrice, book.marketPrice);
    sheet.addRow({
      externalId: book.externalId ?? "",
      title: book.title,
      author: book.author?.name ?? "",
      additionalAuthors: book.additionalAuthors
        .map((aa) => aa.author.name)
        .join("; "),
      isbn: book.isbn ?? "",
      isbn13: book.isbn13 ?? "",
      publisher: book.publisher?.name ?? "",
      format: book.format,
      binding: book.binding,
      numberOfPages: book.numberOfPages ?? "",
      yearPublished: book.yearPublished ?? "",
      originalPublicationYear: book.originalPublicationYear ?? "",
      purchasePrice: decimalToNumber(book.purchasePrice) ?? "",
      marketPrice: decimalToNumber(book.marketPrice) ?? "",
      savings: savings ?? "",
      currency: book.currency,
      isGift: book.isGift ? "Yes" : "No",
      isPubliclyVisible: book.isPubliclyVisible ? "Yes" : "No",
      toSell: book.toSell ? "Yes" : "No",
      edition: book.edition ?? "",
      coverImageUrl: book.coverImageUrl ?? "",
      notes: book.notes ?? "",
      createdAt: book.createdAt.toISOString(),
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filename: exportFilename(collection) };
}
