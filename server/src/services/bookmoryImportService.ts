import type { BookFormat, ReadingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import * as bookService from "./bookService.js";
import * as readingService from "./readingService.js";
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
  status: ReadingStatus;
  numberOfPages: number | null;
  rating: number | null;
  dateStarted: string | null;
  dateFinished: string | null;
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
  readingEntriesCreated: number;
  errors: { row: number; message: string }[];
}

type DuplicateMatch = {
  id: string;
  title: string;
  matchBy: string;
  readingOnly: boolean;
};

async function findDuplicate(row: ParsedBookmoryRow): Promise<DuplicateMatch | null> {
  const titleTrimmed = row.title.trim();
  if (!titleTrimmed) return null;

  const bookSelect = {
    id: true,
    title: true,
    readingOnly: true,
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
          readingOnly: withAuthor.readingOnly,
        };
      }
    }
    const match = byTitle[0];
    return {
      id: match.id,
      title: match.title,
      matchBy: "title",
      readingOnly: match.readingOnly,
    };
  }

  if (row.isbn13) {
    const byIsbn13 = await prisma.book.findFirst({
      where: { isbn13: row.isbn13 },
      select: { id: true, title: true, readingOnly: true },
    });
    if (byIsbn13) {
      return { ...byIsbn13, matchBy: "ISBN-13" };
    }
  }

  if (row.isbn) {
    const byIsbn = await prisma.book.findFirst({
      where: { isbn: row.isbn },
      select: { id: true, title: true, readingOnly: true },
    });
    if (byIsbn) {
      return { ...byIsbn, matchBy: "ISBN" };
    }
  }

  if (row.externalId) {
    const byGoodreadsId = await prisma.book.findFirst({
      where: { externalId: row.externalId },
      select: { id: true, title: true, readingOnly: true },
    });
    if (byGoodreadsId) {
      return { ...byGoodreadsId, matchBy: "Goodreads Id" };
    }
  }

  return null;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(`${toDateOnly(d)}T00:00:00.000Z`);
}

async function recalculateEntryCurrentPage(entryId: string) {
  const entry = await prisma.readingEntry.findUnique({
    where: { id: entryId },
    include: { book: { select: { numberOfPages: true } } },
  });
  if (!entry) return;

  const sessions = await prisma.readingSession.findMany({
    where: { entryId },
    orderBy: [{ sessionDate: "asc" }, { createdAt: "asc" }],
    select: { endPage: true, pagesRead: true },
  });

  let position = 0;
  for (const session of sessions) {
    if (session.endPage != null && session.endPage > position) {
      position = session.endPage;
    } else {
      position += session.pagesRead;
    }
  }

  const maxPages = entry.book.numberOfPages;
  const currentPage =
    position > 0
      ? maxPages && maxPages > 0
        ? Math.min(position, maxPages)
        : position
      : null;

  await prisma.readingEntry.update({
    where: { id: entryId },
    data: { currentPage },
  });
}

async function syncBookReadingStatus(bookId: string) {
  const active = await prisma.readingEntry.findFirst({
    where: { bookId, status: { in: ["READING", "ON_HOLD"] } },
    orderBy: { startedAt: "desc" },
  });

  if (active) {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: active.status,
        dateStartedReading: active.startedAt,
        dateFinishedReading: null,
      },
    });
    return;
  }

  const latestFinished = await prisma.readingEntry.findFirst({
    where: { bookId, status: { in: ["READ", "DID_NOT_FINISH"] } },
    orderBy: { finishedAt: "desc" },
  });

  if (latestFinished) {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: latestFinished.status,
        dateStartedReading: latestFinished.startedAt,
        dateFinishedReading: latestFinished.finishedAt,
      },
    });
  }
}

function toPreviewBook(
  row: ParsedBookmoryRow,
  duplicate: BookmoryPreviewBook["duplicate"],
): BookmoryPreviewBook {
  return {
    sourceRow: row.sourceRow,
    title: row.title,
    author: row.author,
    status: row.status,
    numberOfPages: row.numberOfPages,
    rating: row.rating,
    dateStarted: row.dateStarted?.toISOString().slice(0, 10) ?? null,
    dateFinished: row.dateFinished?.toISOString().slice(0, 10) ?? null,
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
    if (
      row.status !== "TO_READ" ||
      row.dateStarted ||
      row.pagesRead ||
      row.totalReadMinutes
    ) {
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

function resolveImportFlags(
  row: ParsedBookmoryRow,
  settings: BookmoryImportSettings,
) {
  if (settings.importAs === "to_purchase") {
    return {
      readingOnly: false,
      toPurchase: true,
      isPubliclyVisible: false,
    };
  }

  const inLibrary =
    settings.importAs === "library" || row.inLibrary;
  const readingOnly = !inLibrary;
  const toPurchase = !readingOnly && row.toPurchase;

  return {
    readingOnly,
    toPurchase,
    isPubliclyVisible: readingOnly ? false : settings.isPubliclyVisible,
  };
}

async function importReadingDataFromBookmory(
  bookId: string,
  row: ParsedBookmoryRow,
): Promise<boolean> {
  const hasReadingData =
    row.status !== "TO_READ" ||
    row.dateStarted ||
    row.pagesRead ||
    row.totalReadMinutes;

  if (!hasReadingData) {
    return false;
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { numberOfPages: true },
  });

  const pagesRead =
    row.pagesRead ??
    (row.status === "READ" || row.status === "DID_NOT_FINISH"
      ? row.numberOfPages
      : row.currentPage) ??
    0;

  const endPage =
    pagesRead > 0
      ? book?.numberOfPages
        ? Math.min(pagesRead, book.numberOfPages)
        : pagesRead
      : row.currentPage;

  const sessionDate = startOfDay(
    row.dateFinished ?? row.dateStarted ?? row.dateAdded ?? new Date(),
  );

  const isFinished =
    row.status === "READ" || row.status === "DID_NOT_FINISH";

  let entry = await prisma.readingEntry.findFirst({
    where: {
      bookId,
      status: { in: ["READING", "ON_HOLD"] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!entry && isFinished) {
    entry = await prisma.readingEntry.findFirst({
      where: {
        bookId,
        status: row.status,
        sessions: { none: {} },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!entry) {
    const startedAt = row.dateStarted ?? row.dateAdded ?? new Date();
    entry = await prisma.readingEntry.create({
      data: {
        bookId,
        status: isFinished
          ? row.status
          : row.status === "ON_HOLD"
            ? "ON_HOLD"
            : "READING",
        startedAt,
        finishedAt: isFinished
          ? (row.dateFinished ?? row.dateStarted ?? row.dateAdded ?? new Date())
          : null,
        rating: row.rating,
        review: row.notes,
      },
    });
  }

  const importNote = "Imported from Bookmory";
  const targetMinutes = row.totalReadMinutes ?? 0;

  const existingImportSessions = await prisma.readingSession.findMany({
    where: { entryId: entry.id, note: importNote },
    orderBy: { createdAt: "asc" },
  });

  const loggedMinutes = await prisma.readingSession.aggregate({
    where: { entryId: entry.id },
    _sum: { minutesRead: true },
  });
  const existingMinutes = loggedMinutes._sum.minutesRead ?? 0;

  if (targetMinutes > 0 && existingMinutes < targetMinutes) {
    const importSessionMissingMinutes = existingImportSessions.find(
      (session) => (session.minutesRead ?? 0) === 0,
    );
    const sessionMissingMinutes =
      importSessionMissingMinutes ??
      (await prisma.readingSession.findFirst({
        where: {
          entryId: entry.id,
          OR: [{ minutesRead: null }, { minutesRead: 0 }],
        },
        orderBy: { createdAt: "asc" },
      }));

    if (sessionMissingMinutes) {
      await prisma.readingSession.update({
        where: { id: sessionMissingMinutes.id },
        data: {
          minutesRead: targetMinutes,
          ...(pagesRead > 0
            ? {
                pagesRead,
                endPage: endPage && endPage > 0 ? endPage : null,
              }
            : {}),
        },
      });
    } else {
      await prisma.readingSession.create({
        data: {
          entryId: entry.id,
          sessionDate,
          pagesRead: pagesRead > 0 ? pagesRead : 0,
          endPage: endPage && endPage > 0 ? endPage : null,
          minutesRead: targetMinutes,
          note: importNote,
        },
      });
    }
    await recalculateEntryCurrentPage(entry.id);
  } else if (
    pagesRead > 0 &&
    existingImportSessions.length === 0 &&
    existingMinutes === 0
  ) {
    await prisma.readingSession.create({
      data: {
        entryId: entry.id,
        sessionDate,
        pagesRead,
        endPage: endPage && endPage > 0 ? endPage : null,
        minutesRead: targetMinutes > 0 ? targetMinutes : null,
        note: importNote,
      },
    });
    await recalculateEntryCurrentPage(entry.id);
  }

  if (isFinished) {
    await prisma.readingEntry.update({
      where: { id: entry.id },
      data: {
        status: row.status,
        finishedAt:
          row.dateFinished ?? row.dateStarted ?? row.dateAdded ?? new Date(),
        rating: row.rating ?? undefined,
        review: row.notes ?? undefined,
      },
    });
  } else if (row.rating || row.notes) {
    await prisma.readingEntry.update({
      where: { id: entry.id },
      data: {
        rating: row.rating ?? undefined,
        review: row.notes ?? undefined,
      },
    });
  }

  await syncBookReadingStatus(bookId);
  return true;
}

async function mergeDuplicateBook(
  duplicate: DuplicateMatch,
  row: ParsedBookmoryRow,
  bookInput: Parameters<typeof bookService.updateBook>[1],
  authorName: string | undefined,
  format: BookFormat,
) {
  if (duplicate.readingOnly) {
    await readingService.updateReadingOnlyBook(duplicate.id, {
      title: row.title,
      authorName,
      publisherName: row.publisher,
      externalId: row.externalId,
      isbn: row.isbn,
      isbn13: row.isbn13,
      numberOfPages: row.numberOfPages,
      yearPublished: row.yearPublished,
      format,
      coverImageUrl: row.coverImageUrl,
      notes: row.notes,
    });
    if (row.purchasePrice != null) {
      await prisma.book.update({
        where: { id: duplicate.id },
        data: { purchasePrice: row.purchasePrice },
      });
    }
    return;
  }

  await bookService.updateBook(duplicate.id, bookInput);
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
    readingEntriesCreated: 0,
    errors: [],
  };

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    reportProgress(onProgress, "importing", 2 + i, totalSteps, row.title);
    try {
      const flags = resolveImportFlags(row, settings);

      if (
        !row.author &&
        !settings.allowMissingAuthor &&
        !flags.readingOnly
      ) {
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

      const bookshelfNames = [...row.collections, ...row.tags];
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
        status: row.status,
        dateAdded: row.dateAdded ?? new Date(),
        dateStartedReading: row.dateStarted,
        dateFinishedReading: row.dateFinished,
        isPubliclyVisible: flags.isPubliclyVisible,
        isGift: false,
        toPurchase: flags.toPurchase,
        purchasePrice: row.purchasePrice,
        marketPrice: null,
        bookshelfNames,
        bookshelfIds: [] as string[],
        coverImageUrl: row.coverImageUrl,
        notes: row.notes,
        edition: null,
        currency: "SAR",
      };

      let bookId: string;

      if (duplicate) {
        bookId = duplicate.id;

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
          await mergeDuplicateBook(
            duplicate,
            row,
            bookInput,
            authorName,
            format,
          );
          report.updated++;
        } else {
          report.skipped++;
        }

        if (settings.importReadingEntries) {
          const created = await importReadingDataFromBookmory(bookId, row);
          if (created) report.readingEntriesCreated += 1;
        }
        continue;
      }

      if (flags.readingOnly) {
        const result = await readingService.createReadingOnlyBook({
          title: row.title,
          authorName,
          additionalAuthorNames: [],
          publisherName: row.publisher,
          externalId: row.externalId,
          isbn: row.isbn,
          isbn13: row.isbn13,
          numberOfPages: row.numberOfPages,
          yearPublished: row.yearPublished,
          format,
          coverImageUrl: row.coverImageUrl,
          notes: row.notes,
        });
        bookId = result.book.id;
        if (row.purchasePrice != null) {
          await prisma.book.update({
            where: { id: bookId },
            data: { purchasePrice: row.purchasePrice },
          });
        }
        report.imported++;
      } else {
        const book = await bookService.createBook(bookInput);
        bookId = book.id as string;
        report.imported++;
      }

      if (settings.importReadingEntries) {
        const created = await importReadingDataFromBookmory(bookId, row);
        if (created) report.readingEntriesCreated += 1;
      }
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
