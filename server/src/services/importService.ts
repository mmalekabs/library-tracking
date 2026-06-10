import Papa from "papaparse";
import type { BookFormat } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import * as bookService from "./bookService.js";
import {
  detectColumnMapping,
  mapBindingValue,
  parseIsbn,
  parseIsbn13,
  parseOptionalInt,
  parseOptionalNumber,
  splitCommaList,
  type CsvFieldKey,
} from "../utils/csvParse.js";
import type { ImportSettings } from "../validators/import.js";
import type { CreateBookInput } from "../validators/book.js";

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
  createdAuthors: string[];
  createdPublishers: string[];
}

function getMappedValue(
  row: Record<string, string>,
  mapping: Record<string, string>,
  field: CsvFieldKey,
): string {
  const csvColumn = Object.entries(mapping).find(([, v]) => v === field)?.[0];
  if (!csvColumn) return "";
  return row[csvColumn]?.trim() ?? "";
}

function rowToBookInput(
  row: Record<string, string>,
  mapping: Record<string, string>,
  settings: ImportSettings,
): CreateBookInput | null {
  const title = getMappedValue(row, mapping, "title");
  if (!title) return null;

  const authorName = getMappedValue(row, mapping, "author");
  if (!authorName) return null;

  const bindingRaw = getMappedValue(row, mapping, "binding");
  const { format, binding } = mapBindingValue(
    bindingRaw || null,
    settings.defaultFormat as BookFormat,
  );

  const additionalRaw = getMappedValue(row, mapping, "additionalAuthors");

  return {
    title,
    externalId: getMappedValue(row, mapping, "externalId") || null,
    authorName,
    additionalAuthorNames: splitCommaList(additionalRaw),
    additionalAuthorIds: [],
    publisherName: getMappedValue(row, mapping, "publisher") || null,
    isbn: parseIsbn(getMappedValue(row, mapping, "isbn")),
    isbn13: parseIsbn13(getMappedValue(row, mapping, "isbn13")),
    purchasePrice: parseOptionalNumber(
      getMappedValue(row, mapping, "purchasePrice"),
    ),
    marketPrice: parseOptionalNumber(getMappedValue(row, mapping, "marketPrice")),
    format,
    binding,
    numberOfPages: parseOptionalInt(
      getMappedValue(row, mapping, "numberOfPages"),
    ),
    yearPublished: parseOptionalInt(
      getMappedValue(row, mapping, "yearPublished"),
    ),
    originalPublicationYear: parseOptionalInt(
      getMappedValue(row, mapping, "originalPublicationYear"),
    ),
    isPubliclyVisible: settings.defaultVisibility,
    isGift: false,
    toPurchase: settings.defaultToPurchase,
    coverImageUrl: null,
    notes: null,
    edition: null,
    currency: "SAR",
  };
}

async function findDuplicate(
  input: CreateBookInput,
): Promise<{ id: string } | null> {
  if (input.externalId) {
    const byExternal = await prisma.book.findUnique({
      where: { externalId: input.externalId },
      select: { id: true },
    });
    if (byExternal) return byExternal;
  }

  if (input.authorName) {
    const author = await prisma.author.findFirst({
      where: { name: input.authorName.trim() },
    });
    if (author) {
      const byTitle = await prisma.book.findFirst({
        where: {
          title: { equals: input.title.trim(), mode: "insensitive" },
          authorId: author.id,
        },
        select: { id: true },
      });
      if (byTitle) return byTitle;
    }
  }

  const byTitle = await prisma.book.findFirst({
    where: { title: { equals: input.title.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return byTitle;
}

export function parseCsvPreview(csvContent: string) {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data.slice(0, 10);
  const columnMapping = detectColumnMapping(headers);

  const validationErrors: ImportRowError[] = [];
  parsed.data.forEach((row, index) => {
    const title = Object.entries(columnMapping).find(([, f]) => f === "title")?.[0];
    const author = Object.entries(columnMapping).find(([, f]) => f === "author")?.[0];
    if (title && !row[title]?.trim()) {
      validationErrors.push({ row: index + 2, message: "Missing title" });
    }
    if (author && !row[author]?.trim()) {
      validationErrors.push({ row: index + 2, message: "Missing author" });
    }
  });

  return {
    headers,
    previewRows: rows,
    totalRows: parsed.data.length,
    columnMapping,
    validationErrors: validationErrors.slice(0, 20),
    parseErrors: parsed.errors.map((e) => e.message),
  };
}

export async function importBooksFromCsv(
  csvContent: string,
  settings: ImportSettings,
): Promise<ImportReport> {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const report: ImportReport = {
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdAuthors: [],
    createdPublishers: [],
  };

  const mapping = settings.columnMapping;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2;

    try {
      const input = rowToBookInput(row, mapping, settings);
      if (!input) {
        report.failed++;
        report.errors.push({
          row: rowNum,
          message: "Missing required title or author",
        });
        continue;
      }

      const duplicate = await findDuplicate(input);

      if (duplicate && settings.duplicateMode === "skip") {
        report.skipped++;
        continue;
      }

      if (duplicate && settings.duplicateMode === "overwrite") {
        await bookService.updateBook(duplicate.id, input);
        report.imported++;
        continue;
      }

      await bookService.createBook(input);
      report.imported++;

      if (input.authorName && !report.createdAuthors.includes(input.authorName)) {
        report.createdAuthors.push(input.authorName);
      }
      if (
        input.publisherName &&
        !report.createdPublishers.includes(input.publisherName)
      ) {
        report.createdPublishers.push(input.publisherName);
      }
    } catch (err) {
      report.failed++;
      report.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return report;
}
