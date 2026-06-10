import type { Prisma, ReadingStatus } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import {
  findBookIdsByArabicSearch,
  restrictToSearchIds,
} from "../utils/arabicSearch.js";
import type {
  CreateReadingEntryInput,
  CreateReadingOnlyBookInput,
  CreateReadingSessionInput,
  ReadableBooksQuery,
  ReadingHistoryQuery,
  ReadingStatsQuery,
  UpdateReadingEntryInput,
  UpdateReadingOnlyBookInput,
  UpdateReadingSessionInput,
} from "../validators/reading.js";

const readableBookSelect = {
  id: true,
  title: true,
  numberOfPages: true,
  coverImageUrl: true,
  format: true,
  readingOnly: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.BookSelect;

const entryInclude = {
  book: {
    select: readableBookSelect,
  },
  sessions: {
    orderBy: { sessionDate: "desc" as const },
    take: 5,
  },
} satisfies Prisma.ReadingEntryInclude;

function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`);
  }
  return new Date(value);
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(`${toDateOnly(d)}T00:00:00.000Z`);
}

function endOfDay(d: Date): Date {
  return new Date(`${toDateOnly(d)}T23:59:59.999Z`);
}

function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return toDateOnly(date);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function yearKey(d: Date): string {
  return String(d.getUTCFullYear());
}

async function getEntryTotals(entryId: string) {
  const agg = await prisma.readingSession.aggregate({
    where: { entryId },
    _sum: { pagesRead: true, minutesRead: true },
    _count: true,
  });
  return {
    totalPagesRead: agg._sum.pagesRead ?? 0,
    totalMinutes: agg._sum.minutesRead ?? 0,
    sessionCount: agg._count,
  };
}

/** Furthest page reached in the book for this entry (from endPage or summed pages). */
async function getReadingPosition(
  entryId: string,
  excludeSessionId?: string,
): Promise<number> {
  const sessions = await prisma.readingSession.findMany({
    where: {
      entryId,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
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
  return position;
}

async function resolveSessionPages(
  entryId: string,
  input: { endPage?: number | null; pagesRead?: number },
  excludeSessionId?: string,
): Promise<{ pagesRead: number; endPage: number | null }> {
  const prior = await getReadingPosition(entryId, excludeSessionId);
  const entry = await prisma.readingEntry.findUnique({
    where: { id: entryId },
    select: { book: { select: { numberOfPages: true } } },
  });
  const maxPage = entry?.book.numberOfPages ?? null;

  if (input.endPage != null) {
    let endPage = Math.max(0, input.endPage);
    if (maxPage != null && maxPage > 0) {
      endPage = Math.min(endPage, maxPage);
    }
    if (endPage < prior) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Last page must be at least ${prior} (your current position)`,
      );
    }
    return { pagesRead: endPage - prior, endPage: endPage > 0 ? endPage : null };
  }

  const pagesRead = input.pagesRead ?? 0;
  let endPage = pagesRead > 0 ? prior + pagesRead : null;
  if (endPage != null && maxPage != null && maxPage > 0) {
    endPage = Math.min(endPage, maxPage);
  }
  return { pagesRead, endPage };
}

function computeCurrentPage(
  totalPagesRead: number,
  bookPageCount: number | null,
): number {
  if (bookPageCount && bookPageCount > 0) {
    return Math.min(totalPagesRead, bookPageCount);
  }
  return totalPagesRead;
}

async function syncBookFromEntries(bookId: string) {
  const active = await prisma.readingEntry.findFirst({
    where: {
      bookId,
      status: { in: ["READING", "ON_HOLD"] },
    },
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
    where: {
      bookId,
      status: { in: ["READ", "DID_NOT_FINISH"] },
    },
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
    return;
  }

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "TO_READ",
      dateStartedReading: null,
      dateFinishedReading: null,
    },
  });
}

function serializeEntry(
  entry: Prisma.ReadingEntryGetPayload<{ include: typeof entryInclude }>,
  totals: { totalPagesRead: number; totalMinutes: number; sessionCount: number },
) {
  const totalPages = entry.book.numberOfPages;
  const progressPage =
    entry.currentPage ??
    computeCurrentPage(totals.totalPagesRead, totalPages);
  const progressPercent =
    totalPages && totalPages > 0
      ? Math.min(100, Math.round((progressPage / totalPages) * 1000) / 10)
      : null;

  const calendarDays =
    entry.finishedAt || entry.status === "READING" || entry.status === "ON_HOLD"
      ? Math.max(
          1,
          Math.ceil(
            ((entry.finishedAt ?? new Date()).getTime() - entry.startedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  return {
    id: entry.id,
    bookId: entry.bookId,
    status: entry.status,
    startedAt: entry.startedAt.toISOString(),
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    currentPage: progressPage,
    rating: entry.rating,
    review: entry.review,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    book: entry.book,
    recentSessions: entry.sessions.map((s) => ({
      id: s.id,
      sessionDate: toDateOnly(s.sessionDate),
      pagesRead: s.pagesRead,
      minutesRead: s.minutesRead,
      endPage: s.endPage,
      note: s.note,
    })),
    totalPagesRead: totals.totalPagesRead,
    totalMinutes: totals.totalMinutes,
    sessionCount: totals.sessionCount,
    progressPage,
    progressPercent,
    calendarDays,
  };
}

export async function listCurrentlyReading() {
  const entries = await prisma.readingEntry.findMany({
    where: { status: { in: ["READING", "ON_HOLD"] } },
    include: entryInclude,
    orderBy: { startedAt: "desc" },
  });

  return Promise.all(
    entries.map(async (entry) => {
      const totals = await getEntryTotals(entry.id);
      return serializeEntry(entry, totals);
    }),
  );
}

export async function listHistory(query: ReadingHistoryQuery) {
  const where: Prisma.ReadingEntryWhereInput =
    query.status === "all"
      ? { status: { in: ["READ", "DID_NOT_FINISH"] } }
      : { status: query.status };

  const [entries, total] = await Promise.all([
    prisma.readingEntry.findMany({
      where,
      include: entryInclude,
      orderBy: { finishedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.readingEntry.count({ where }),
  ]);

  const data = await Promise.all(
    entries.map(async (entry) => {
      const totals = await getEntryTotals(entry.id);
      return serializeEntry(entry, totals);
    }),
  );

  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems: total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getEntryById(id: string) {
  const entry = await prisma.readingEntry.findUnique({
    where: { id },
    include: {
      ...entryInclude,
      sessions: { orderBy: { sessionDate: "desc" } },
    },
  });
  if (!entry) throw new AppError(404, "NOT_FOUND", "Reading entry not found");

  const totals = await getEntryTotals(id);
  return {
    ...serializeEntry(entry, totals),
    sessions: entry.sessions.map((s) => ({
      id: s.id,
      sessionDate: toDateOnly(s.sessionDate),
      pagesRead: s.pagesRead,
      minutesRead: s.minutesRead,
      endPage: s.endPage,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

async function resolveAuthorId(authorName?: string | null): Promise<string | null> {
  const trimmed = authorName?.trim();
  if (!trimmed) return null;
  const author = await prisma.author.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
  return author.id;
}

async function resolvePublisherId(
  publisherName?: string | null,
): Promise<string | null> {
  const trimmed = publisherName?.trim();
  if (!trimmed) return null;
  const publisher = await prisma.publisher.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
  return publisher.id;
}

async function resolveAdditionalAuthorIds(names: string[] = []): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const id = await resolveAuthorId(name);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function normalizeCoverUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  return trimmed || null;
}

export async function listReadableBooks(query: ReadableBooksQuery) {
  let where: Prisma.BookWhereInput = { toPurchase: false };

  if (query.search?.trim()) {
    const ids = await findBookIdsByArabicSearch(query.search.trim());
    where = restrictToSearchIds(where, ids);
  }

  const books = await prisma.book.findMany({
    where,
    select: readableBookSelect,
    orderBy: [{ readingOnly: "asc" }, { title: "asc" }],
    take: query.limit,
  });

  return books;
}

export async function getReadingOnlyBookById(id: string) {
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      additionalAuthors: { include: { author: { select: { id: true, name: true } } } },
      publisher: { select: { id: true, name: true } },
    },
  });
  if (!book || !book.readingOnly) {
    throw new AppError(404, "NOT_FOUND", "Reading-only book not found");
  }
  return {
    id: book.id,
    externalId: book.externalId,
    title: book.title,
    isbn: book.isbn,
    isbn13: book.isbn13,
    format: book.format,
    binding: book.binding,
    numberOfPages: book.numberOfPages,
    yearPublished: book.yearPublished,
    originalPublicationYear: book.originalPublicationYear,
    edition: book.edition,
    coverImageUrl: book.coverImageUrl,
    notes: book.notes,
    readingOnly: book.readingOnly,
    author: book.author,
    additionalAuthors: book.additionalAuthors.map((aa) => aa.author),
    publisher: book.publisher,
  };
}

export async function updateReadingOnlyBook(
  id: string,
  input: UpdateReadingOnlyBookInput,
) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing?.readingOnly) {
    throw new AppError(404, "NOT_FOUND", "Reading-only book not found");
  }

  const authorId =
    input.authorName !== undefined
      ? await resolveAuthorId(input.authorName)
      : undefined;

  const publisherId =
    input.publisherName !== undefined
      ? await resolvePublisherId(input.publisherName)
      : undefined;

  const data: Prisma.BookUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.externalId !== undefined) data.externalId = input.externalId?.trim() || null;
  if (authorId !== undefined) data.authorId = authorId;
  if (publisherId !== undefined) data.publisherId = publisherId;
  if (input.isbn !== undefined) data.isbn = input.isbn?.trim() || null;
  if (input.isbn13 !== undefined) data.isbn13 = input.isbn13?.trim() || null;
  if (input.edition !== undefined) data.edition = input.edition?.trim() || null;
  if (input.format !== undefined) data.format = input.format;
  if (input.binding !== undefined) data.binding = input.binding;
  if (input.numberOfPages !== undefined) data.numberOfPages = input.numberOfPages;
  if (input.yearPublished !== undefined) data.yearPublished = input.yearPublished;
  if (input.originalPublicationYear !== undefined) {
    data.originalPublicationYear = input.originalPublicationYear;
  }
  if (input.coverImageUrl !== undefined) {
    data.coverImageUrl = normalizeCoverUrl(input.coverImageUrl);
  }
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

  if (input.additionalAuthorNames !== undefined) {
    const additionalAuthorIds = await resolveAdditionalAuthorIds(
      input.additionalAuthorNames,
    );
    await prisma.bookAdditionalAuthor.deleteMany({ where: { bookId: id } });
    if (additionalAuthorIds.length > 0) {
      await prisma.bookAdditionalAuthor.createMany({
        data: additionalAuthorIds.map((authorId) => ({ bookId: id, authorId })),
      });
    }
  }

  await prisma.book.update({ where: { id }, data });
  return getReadingOnlyBookById(id);
}

export async function createReadingOnlyBook(input: CreateReadingOnlyBookInput) {
  const authorId = await resolveAuthorId(input.authorName);
  const publisherId = await resolvePublisherId(input.publisherName);
  const additionalAuthorIds = await resolveAdditionalAuthorIds(
    input.additionalAuthorNames ?? [],
  );

  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      externalId: input.externalId?.trim() || null,
      authorId,
      publisherId,
      isbn: input.isbn?.trim() || null,
      isbn13: input.isbn13?.trim() || null,
      edition: input.edition?.trim() || null,
      format: input.format ?? "DIGITAL",
      binding: input.binding ?? "PAPERBACK",
      numberOfPages: input.numberOfPages ?? null,
      yearPublished: input.yearPublished ?? null,
      originalPublicationYear: input.originalPublicationYear ?? null,
      coverImageUrl: normalizeCoverUrl(input.coverImageUrl),
      notes: input.notes?.trim() || null,
      readingOnly: true,
      toPurchase: false,
      isPubliclyVisible: false,
      status: "TO_READ",
      additionalAuthors: {
        create: additionalAuthorIds.map((authorId) => ({ authorId })),
      },
    },
    select: readableBookSelect,
  });

  if (!input.entry) {
    return { book, entry: null };
  }

  const entry = await createEntry({
    bookId: book.id,
    status: input.entry.status,
    startedAt: input.entry.startedAt,
    finishedAt: input.entry.finishedAt,
    currentPage: input.entry.currentPage,
    rating: input.entry.rating,
    review: input.entry.review,
  });

  return { book, entry };
}

export async function createEntry(input: CreateReadingEntryInput) {
  const book = await prisma.book.findUnique({ where: { id: input.bookId } });
  if (!book) throw new AppError(404, "NOT_FOUND", "Book not found");
  if (book.toPurchase) {
    throw new AppError(400, "VALIDATION_ERROR", "Cannot track reading for wishlist books");
  }

  const status = input.status ?? "READING";

  if (["READING", "ON_HOLD"].includes(status)) {
    const existingActive = await prisma.readingEntry.findFirst({
      where: {
        bookId: input.bookId,
        status: { in: ["READING", "ON_HOLD"] },
      },
    });
    if (existingActive) {
      throw new AppError(
        400,
        "ALREADY_READING",
        "This book already has an active reading entry",
      );
    }
  }

  const startedAt = parseDateInput(input.startedAt) ?? new Date();
  const finishedAt =
    status === "READ" || status === "DID_NOT_FINISH"
      ? (parseDateInput(input.finishedAt) ?? new Date())
      : null;

  const entry = await prisma.readingEntry.create({
    data: {
      bookId: input.bookId,
      status,
      startedAt,
      finishedAt,
      currentPage: null,
      rating: input.rating ?? null,
      review: input.review ?? null,
    },
    include: entryInclude,
  });

  await syncBookFromEntries(input.bookId);
  const totals = await getEntryTotals(entry.id);
  return serializeEntry(entry, totals);
}

export async function updateEntry(id: string, input: UpdateReadingEntryInput) {
  const existing = await prisma.readingEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Reading entry not found");

  const data: Prisma.ReadingEntryUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status as ReadingStatus;
    if (input.status === "READ" || input.status === "DID_NOT_FINISH") {
      data.finishedAt = parseDateInput(input.finishedAt) ?? new Date();
    }
    if (input.status === "READING") {
      data.finishedAt = null;
    }
  }

  if (input.startedAt !== undefined) {
    const parsed = parseDateInput(input.startedAt);
    if (parsed) data.startedAt = parsed;
  }
  if (input.finishedAt !== undefined && input.status === undefined) {
    data.finishedAt = parseDateInput(input.finishedAt);
  }
  if (input.rating !== undefined) data.rating = input.rating;
  if (input.review !== undefined) data.review = input.review;

  const entry = await prisma.readingEntry.update({
    where: { id },
    data,
    include: entryInclude,
  });

  await syncBookFromEntries(existing.bookId);
  const totals = await getEntryTotals(entry.id);
  return serializeEntry(entry, totals);
}

async function recalculateEntryProgress(entryId: string) {
  const entry = await prisma.readingEntry.findUnique({
    where: { id: entryId },
    include: { book: { select: { numberOfPages: true } } },
  });
  if (!entry) return;

  const position = await getReadingPosition(entryId);
  const currentPage =
    position > 0
      ? computeCurrentPage(position, entry.book.numberOfPages)
      : null;

  await prisma.readingEntry.update({
    where: { id: entryId },
    data: { currentPage },
  });
}

function serializeSession(session: {
  id: string;
  sessionDate: Date;
  pagesRead: number;
  minutesRead: number | null;
  endPage: number | null;
  note: string | null;
  createdAt: Date;
}) {
  return {
    id: session.id,
    sessionDate: toDateOnly(session.sessionDate),
    pagesRead: session.pagesRead,
    minutesRead: session.minutesRead,
    endPage: session.endPage,
    note: session.note,
    createdAt: session.createdAt.toISOString(),
  };
}

export async function logSession(entryId: string, input: CreateReadingSessionInput) {
  const entry = await prisma.readingEntry.findUnique({
    where: { id: entryId },
    include: { book: { select: { numberOfPages: true } } },
  });
  if (!entry) throw new AppError(404, "NOT_FOUND", "Reading entry not found");
  if (!["READING", "ON_HOLD"].includes(entry.status)) {
    throw new AppError(400, "VALIDATION_ERROR", "Can only log sessions for active reads");
  }

  const sessionDate = parseDateInput(input.sessionDate);
  if (!sessionDate) throw new AppError(400, "VALIDATION_ERROR", "Invalid session date");

  const { pagesRead, endPage } = await resolveSessionPages(entryId, {
    endPage: input.endPage,
    pagesRead: input.pagesRead,
  });

  const session = await prisma.readingSession.create({
    data: {
      entryId,
      sessionDate: startOfDay(sessionDate),
      pagesRead,
      minutesRead: input.minutesRead ?? null,
      endPage,
      note: input.note ?? null,
    },
  });

  await recalculateEntryProgress(entryId);

  if (entry.status === "ON_HOLD") {
    await prisma.readingEntry.update({
      where: { id: entryId },
      data: { status: "READING" },
    });
    await syncBookFromEntries(entry.bookId);
  }

  return serializeSession(session);
}

export async function updateSession(
  sessionId: string,
  input: UpdateReadingSessionInput,
) {
  const existing = await prisma.readingSession.findUnique({
    where: { id: sessionId },
    select: {
      entryId: true,
      pagesRead: true,
      endPage: true,
    },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Session not found");

  const data: Prisma.ReadingSessionUpdateInput = {};
  if (input.sessionDate !== undefined) {
    const sessionDate = parseDateInput(input.sessionDate);
    if (!sessionDate) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid session date");
    }
    data.sessionDate = startOfDay(sessionDate);
  }
  if (input.endPage !== undefined || input.pagesRead !== undefined) {
    const resolved = await resolveSessionPages(
      existing.entryId,
      {
        endPage:
          input.endPage !== undefined ? input.endPage : existing.endPage,
        pagesRead:
          input.pagesRead !== undefined ? input.pagesRead : existing.pagesRead,
      },
      sessionId,
    );
    data.pagesRead = resolved.pagesRead;
    data.endPage = resolved.endPage;
  }
  if (input.minutesRead !== undefined) data.minutesRead = input.minutesRead;
  if (input.note !== undefined) data.note = input.note?.trim() || null;

  const session = await prisma.readingSession.update({
    where: { id: sessionId },
    data,
  });

  await recalculateEntryProgress(existing.entryId);

  return serializeSession(session);
}

export async function deleteSession(sessionId: string) {
  const session = await prisma.readingSession.findUnique({
    where: { id: sessionId },
    select: { entryId: true },
  });
  if (!session) throw new AppError(404, "NOT_FOUND", "Session not found");

  await prisma.readingSession.delete({ where: { id: sessionId } });
  await recalculateEntryProgress(session.entryId);
  return { deleted: true, entryId: session.entryId };
}

function periodKey(date: Date, period: ReadingStatsQuery["period"]): string {
  switch (period) {
    case "day":
      return toDateOnly(date);
    case "week":
      return weekKey(date);
    case "month":
      return monthKey(date);
    case "year":
      return yearKey(date);
  }
}

export async function getReadingStats(query: ReadingStatsQuery) {
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const from = query.from ? startOfDay(parseDateInput(query.from)!) : startOfDay(defaultFrom);
  const to = query.to ? endOfDay(parseDateInput(query.to)!) : endOfDay(now);

  const sessions = await prisma.readingSession.findMany({
    where: {
      sessionDate: { gte: from, lte: to },
      entry: { book: { toPurchase: false } },
    },
    select: {
      sessionDate: true,
      pagesRead: true,
      minutesRead: true,
      entryId: true,
      entry: {
        select: {
          bookId: true,
          book: { select: { title: true, author: { select: { name: true } } } },
        },
      },
    },
    orderBy: { sessionDate: "asc" },
  });

  const bucketMap = new Map<
    string,
    { period: string; pagesRead: number; minutesRead: number; sessions: number }
  >();

  for (const s of sessions) {
    const key = periodKey(s.sessionDate, query.period);
    const row = bucketMap.get(key) ?? {
      period: key,
      pagesRead: 0,
      minutesRead: 0,
      sessions: 0,
    };
    row.pagesRead += s.pagesRead;
    row.minutesRead += s.minutesRead ?? 0;
    row.sessions += 1;
    bucketMap.set(key, row);
  }

  const timeline = [...bucketMap.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );

  const finishedInRange = await prisma.readingEntry.findMany({
    where: {
      status: "READ",
      finishedAt: { gte: from, lte: to },
      book: { toPurchase: false },
    },
    select: { id: true, finishedAt: true },
  });

  const totals = sessions.reduce(
    (acc, s) => {
      acc.pagesRead += s.pagesRead;
      acc.minutesRead += s.minutesRead ?? 0;
      acc.sessions += 1;
      return acc;
    },
    { pagesRead: 0, minutesRead: 0, sessions: 0 },
  );

  return {
    period: query.period,
    from: toDateOnly(from),
    to: toDateOnly(to),
    totals: {
      ...totals,
      booksFinished: finishedInRange.length,
    },
    timeline,
  };
}

export async function getBookTimeStats() {
  const entries = await prisma.readingEntry.findMany({
    where: {
      book: { toPurchase: false },
      status: { in: ["READ", "DID_NOT_FINISH", "READING", "ON_HOLD"] },
    },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          numberOfPages: true,
          coverImageUrl: true,
          author: { select: { name: true } },
        },
      },
      sessions: {
        select: { pagesRead: true, minutesRead: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const byBook = new Map<
    string,
    {
      bookId: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      numberOfPages: number | null;
      readCount: number;
      totalPagesRead: number;
      totalMinutes: number;
      totalCalendarDays: number;
      entries: {
        id: string;
        status: ReadingStatus;
        startedAt: string;
        finishedAt: string | null;
        rating: number | null;
        pagesRead: number;
        minutes: number;
        calendarDays: number | null;
      }[];
    }
  >();

  for (const entry of entries) {
    const pagesRead = entry.sessions.reduce((s, x) => s + x.pagesRead, 0);
    const minutes = entry.sessions.reduce((s, x) => s + (x.minutesRead ?? 0), 0);
    const calendarDays =
      entry.finishedAt || entry.status === "READING" || entry.status === "ON_HOLD"
        ? Math.max(
            1,
            Math.ceil(
              ((entry.finishedAt ?? new Date()).getTime() - entry.startedAt.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

    const row =
      byBook.get(entry.bookId) ??
      {
        bookId: entry.bookId,
        title: entry.book.title,
        author: entry.book.author?.name ?? "—",
        coverImageUrl: entry.book.coverImageUrl,
        numberOfPages: entry.book.numberOfPages,
        readCount: 0,
        totalPagesRead: 0,
        totalMinutes: 0,
        totalCalendarDays: 0,
        entries: [],
      };

    if (entry.status === "READ") row.readCount += 1;
    row.totalPagesRead += pagesRead;
    row.totalMinutes += minutes;
    if (calendarDays) row.totalCalendarDays += calendarDays;

    row.entries.push({
      id: entry.id,
      status: entry.status,
      startedAt: entry.startedAt.toISOString(),
      finishedAt: entry.finishedAt?.toISOString() ?? null,
      rating: entry.rating,
      pagesRead,
      minutes,
      calendarDays,
    });

    byBook.set(entry.bookId, row);
  }

  return [...byBook.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export async function getReadingSummary() {
  const [currentlyReading, historyCount, sessionTotals, yearFinished] =
    await Promise.all([
      prisma.readingEntry.count({
        where: { status: { in: ["READING", "ON_HOLD"] } },
      }),
      prisma.readingEntry.count({
        where: { status: { in: ["READ", "DID_NOT_FINISH"] } },
      }),
      prisma.readingSession.aggregate({
        _sum: { pagesRead: true, minutesRead: true },
        _count: true,
      }),
      prisma.readingEntry.count({
        where: {
          status: "READ",
          finishedAt: {
            gte: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)),
          },
        },
      }),
    ]);

  const today = toDateOnly(new Date());
  const todayStats = await prisma.readingSession.aggregate({
    where: { sessionDate: startOfDay(new Date()) },
    _sum: { pagesRead: true, minutesRead: true },
  });

  const weekStart = startOfDay(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() || 7) - 1));
  const weekStats = await prisma.readingSession.aggregate({
    where: { sessionDate: { gte: weekStart } },
    _sum: { pagesRead: true, minutesRead: true },
  });

  const monthStart = startOfDay(
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
  );
  const monthStats = await prisma.readingSession.aggregate({
    where: { sessionDate: { gte: monthStart } },
    _sum: { pagesRead: true, minutesRead: true },
  });

  return {
    currentlyReading,
    historyCount,
    totalSessions: sessionTotals._count,
    totalPagesLogged: sessionTotals._sum.pagesRead ?? 0,
    totalMinutesLogged: sessionTotals._sum.minutesRead ?? 0,
    booksFinishedThisYear: yearFinished,
    today: {
      pagesRead: todayStats._sum.pagesRead ?? 0,
      minutesRead: todayStats._sum.minutesRead ?? 0,
      date: today,
    },
    thisWeek: {
      pagesRead: weekStats._sum.pagesRead ?? 0,
      minutesRead: weekStats._sum.minutesRead ?? 0,
    },
    thisMonth: {
      pagesRead: monthStats._sum.pagesRead ?? 0,
      minutesRead: monthStats._sum.minutesRead ?? 0,
    },
  };
}
