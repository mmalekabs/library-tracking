import type { BookFormat } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import * as bookService from "./bookService.js";
import {
  parseBookmoryFile,
  type BookmoryField,
  type ParsedBookmoryRow,
} from "../utils/bookmoryParse.js";
import type { BookmoryImportSettings } from "../validators/bookmoryImport.js";

export type BookmoryProgressPhase = "parsing" | "checking" | "importing";

export interface BookmoryProgressUpdate {
  phase: BookmoryProgressPhase;
  current: number;
  total: number;
  currentTitle: string | null;
  percent: number;
}

export type BookmoryProgressCallback = (update: BookmoryProgressUpdate) => void;

function reportProgress(
  onProgress: BookmoryProgressCallback | undefined,
  phase: BookmoryProgressPhase,
  step: number,
  totalSteps: number,
  currentTitle: string | null,
) {
  onProgress?.({
    phase,
    current: step,
    total: totalSteps,
    currentTitle,
    percent:
      totalSteps > 0
        ? Math.min(100, Math.round((step / totalSteps) * 100))
        : 0,
  });
}

export interface BookmoryPreviewBook {
  sourceRow: number;
  title: string;
  author: string | null;
  numberOfPages: number | null;
  rating: number | null;
  pagesRead: number | null;
  totalReadMinutes: number | null;
  totalReadTimeRaw: string | null;
  tags: string[];
  collections: string[];
  toPurchase: boolean;
  inLibrary: boolean;
  externalId: string | null;
  warnings: string[];
  duplicate: { id: string; title: string; matchBy: string } | null;
}

export interface BookmoryImportPreview {
  fileName: string;
  format: "xlsx" | "csv" | "json";
  headers: string[];
  columnMapping: Record<string, BookmoryField>;
  headerRowIndex: number;
  parseWarnings: string[];
  books: BookmoryPreviewBook[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    withReadingData: number;
    withReadTime: number;
    withGoodreadsId: number;
    wishlist: number;
    inLibrary: number;
  };
}

export interface BookmoryImportReport {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

type DuplicateMatch = {
  id: string;
  title: string;
  matchBy: string;
};

async function findDuplicate(row: ParsedBookmoryRow): Promise<DuplicateMatch | null> {
  const titleTrimmed = row.title.trim();
  if (!titleTrimmed) return null;

  const bookSelect = {
    id: true,
    title: true,
    author: { select: { name: true } },
  } as const;

  const byTitle = await prisma.book.findMany({
    where: { title: { equals: titleTrimmed, mode: "insensitive" } },
    select: bookSelect,
  });

  if (byTitle.length > 0) {
    if (row.author) {
      const authorNorm = row.author.trim().toLowerCase();
      const withAuthor = byTitle.find(
        (book) => book.author?.name.trim().toLowerCase() === authorNorm,
      );
      if (withAuthor) {
        return {
          id: withAuthor.id,
          title: withAuthor.title,
          matchBy: "title + author",
        };
      }
    }
    const match = byTitle[0];
    return {
      id: match.id,
      title: match.title,
      matchBy: "title",
    };
  }

  if (row.isbn13) {
    const byIsbn13 = await prisma.book.findFirst({
      where: { isbn13: row.isbn13 },
      select: { id: true, title: true },
    });
    if (byIsbn13) {
      return { ...byIsbn13, matchBy: "ISBN-13" };
    }
  }

  if (row.isbn) {
    const byIsbn = await prisma.book.findFirst({
      where: { isbn: row.isbn },
      select: { id: true, title: true },
    });
    if (byIsbn) {
      return { ...byIsbn, matchBy: "ISBN" };
    }
  }

  if (row.externalId) {
    const byGoodreadsId = await prisma.book.findFirst({
      where: { externalId: row.externalId },
      select: { id: true, title: true },
    });
    if (byGoodreadsId) {
      return { ...byGoodreadsId, matchBy: "Goodreads Id" };
    }
  }

  return null;
}

function toPreviewBook(
  row: ParsedBookmoryRow,
  duplicate: BookmoryPreviewBook["duplicate"],
): BookmoryPreviewBook {
  return {
    sourceRow: row.sourceRow,
    title: row.title,
    author: row.author,
    numberOfPages: row.numberOfPages,
    rating: row.rating,
    pagesRead: row.pagesRead,
    totalReadMinutes: row.totalReadMinutes,
    totalReadTimeRaw: row.totalReadTimeRaw,
    tags: row.tags,
    collections: row.collections,
    toPurchase: row.toPurchase,
    inLibrary: row.inLibrary,
    externalId: row.externalId,
    warnings: row.warnings,
    duplicate,
  };
}

export async function previewBookmoryImport(
  buffer: Buffer,
  fileName: string,
  onProgress?: BookmoryProgressCallback,
): Promise<BookmoryImportPreview> {
  reportProgress(onProgress, "parsing", 0, 1, "Reading export file…");
  const parsed = await parseBookmoryFile(buffer, fileName);
  const totalSteps = 1 + parsed.rows.length;
  reportProgress(onProgress, "parsing", 1, totalSteps, null);

  const books: BookmoryPreviewBook[] = [];
  let duplicates = 0;
  let withReadingData = 0;
  let withReadTime = 0;
  let withGoodreadsId = 0;
  let wishlist = 0;
  let inLibrary = 0;

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    reportProgress(onProgress, "checking", 2 + i, totalSteps, row.title);
    const duplicate = await findDuplicate(row);
    if (duplicate) duplicates += 1;
    if (row.pagesRead || row.totalReadMinutes) {
      withReadingData += 1;
    }
    if (row.totalReadMinutes != null) withReadTime += 1;
    if (row.externalId) withGoodreadsId += 1;
    if (row.toPurchase) wishlist += 1;
    if (row.inLibrary) inLibrary += 1;
    books.push(toPreviewBook(row, duplicate));
  }

  return {
    fileName,
    format: parsed.format,
    headers: parsed.headers,
    columnMapping: parsed.columnMapping,
    headerRowIndex: parsed.headerRowIndex,
    parseWarnings: parsed.parseWarnings,
    books,
    summary: {
      total: books.length,
      valid: books.length,
      duplicates,
      withReadingData,
      withReadTime,
      withGoodreadsId,
      wishlist,
      inLibrary,
    },
  };
}

function resolveImportFlags(settings: BookmoryImportSettings) {
  if (settings.importAs === "to_purchase") {
    return {
      toPurchase: true,
      isPubliclyVisible: false,
    };
  }
  return {
    toPurchase: false,
    isPubliclyVisible: settings.isPubliclyVisible,
  };
}

export async function importBookmoryFile(
  buffer: Buffer,
  fileName: string,
  settings: BookmoryImportSettings,
  onProgress?: BookmoryProgressCallback,
): Promise<BookmoryImportReport> {
  reportProgress(onProgress, "parsing", 0, 1, "Reading export file…");
  const parsed = await parseBookmoryFile(buffer, fileName);
  const totalSteps = 1 + parsed.rows.length;
  reportProgress(onProgress, "parsing", 1, totalSteps, null);

  const report: BookmoryImportReport = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    reportProgress(onProgress, "importing", 2 + i, totalSteps, row.title);
    try {
      const flags = resolveImportFlags(settings);

      if (!row.author && !settings.allowMissingAuthor && !flags.toPurchase) {
        report.failed++;
        report.errors.push({
          row: row.sourceRow,
          message: "Missing author",
        });
        continue;
      }

      const authorName =
        row.author ??
        (settings.allowMissingAuthor ? "Unknown" : undefined);

      const duplicate = await findDuplicate(row);

      const format: BookFormat = row.format ?? "PHYSICAL";

      const bookInput = {
        title: row.title,
        authorName,
        additionalAuthorNames: [] as string[],
        additionalAuthorIds: [] as string[],
        publisherName: row.publisher,
        externalId: row.externalId,
        isbn: row.isbn,
        isbn13: row.isbn13,
        numberOfPages: row.numberOfPages,
        yearPublished: row.yearPublished,
        originalPublicationYear: row.yearPublished,
        format,
        binding: "PAPERBACK" as const,
        isPubliclyVisible: flags.isPubliclyVisible,
        isGift: false,
        toPurchase: flags.toPurchase || row.toPurchase,
        toSell: false,
        purchasePrice: row.purchasePrice,
        marketPrice: null,
        coverImageUrl: row.coverImageUrl,
        notes: row.notes,
        edition: null,
        currency: "SAR",
      };

      if (duplicate) {
        if (settings.duplicateMode === "update_goodreads_id") {
          if (!row.externalId) {
            report.skipped++;
            report.errors.push({
              row: row.sourceRow,
              message: "No Goodreads Id in file for matched book",
            });
          } else {
            await prisma.book.update({
              where: { id: duplicate.id },
              data: { externalId: row.externalId },
            });
            report.updated++;
          }
          continue;
        }

        if (settings.duplicateMode === "overwrite") {
          await bookService.updateBook(duplicate.id, bookInput);
          report.updated++;
        } else {
          report.skipped++;
        }
        continue;
      }

      await bookService.createBook(bookInput);
      report.imported++;
    } catch (err) {
      report.failed++;
      report.errors.push({
        row: row.sourceRow,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return report;
}
