import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { calculateSavings, decimalToNumber } from "../utils/book.js";
import {
  findBookIdsByArabicSearch,
  restrictToSearchIds,
} from "../utils/arabicSearch.js";
import { isValidIsbn13, needsIsbn13 } from "../utils/isbn.js";
import type { EntityBooksQuery } from "../validators/entity.js";
import type {
  BookListQuery,
  BulkFetchCoversInput,
  CreateBookInput,
  BulkFetchIsbnInput,
  BulkFetchMarketPriceInput,
  MissingInfoQuery,
  MoveToLibraryInput,
  UpdateBookInput,
} from "../validators/book.js";
import * as aseeralkotbService from "./aseeralkotbService.js";
import * as goodreadsService from "./goodreadsService.js";

export const bookInclude = {
  author: { select: { id: true, name: true } },
  additionalAuthors: {
    include: { author: { select: { id: true, name: true } } },
  },
  publisher: { select: { id: true, name: true } },
} satisfies Prisma.BookInclude;

type BookWithRelations = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

export interface SerializeBookOptions {
  includePricing?: boolean;
  includeAdminFields?: boolean;
}

export function serializeBook(
  book: BookWithRelations,
  options: SerializeBookOptions = {},
) {
  const { includePricing = false, includeAdminFields = false } = options;

  const purchasePrice = decimalToNumber(book.purchasePrice);
  const marketPrice = decimalToNumber(book.marketPrice);

  const base = {
    id: book.id,
    externalId: book.externalId,
    title: book.title,
    isbn: book.isbn,
    isbn13: book.isbn13,
    currency: book.currency,
    format: book.format,
    binding: book.binding,
    numberOfPages: book.numberOfPages,
    yearPublished: book.yearPublished,
    originalPublicationYear: book.originalPublicationYear,
    edition: book.edition,
    coverImageUrl: book.coverImageUrl,
    author: book.author,
    additionalAuthors: book.additionalAuthors.map((aa) => aa.author),
    publisher: book.publisher,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };

  if (includePricing) {
    return {
      ...base,
      purchasePrice,
      marketPrice,
      savings: calculateSavings(book.purchasePrice, book.marketPrice),
      ...(includeAdminFields && {
        isPubliclyVisible: book.isPubliclyVisible,
        isGift: book.isGift,
        toPurchase: book.toPurchase,
        notes: book.notes,
      }),
    };
  }

  return base;
}

function buildWhereClause(
  query: BookListQuery,
  options: {
    publicOnly?: boolean;
    /** When publicOnly: library = owned catalog; to_purchase = public wishlist */
    publicCollection?: "library" | "to_purchase";
  } = {},
): Prisma.BookWhereInput {
  const { publicOnly = false, publicCollection = "library" } = options;
  const where: Prisma.BookWhereInput = {};

  if (publicOnly) {
    where.isPubliclyVisible = true;
    where.toPurchase = publicCollection === "to_purchase";
  } else if (query.collection === "to_purchase") {
    where.toPurchase = true;
  } else if (query.collection === "all") {
    // No collection filter — includes library and wishlist
  } else {
    where.toPurchase = false;
  }

  if (!publicOnly) {
    if (query.visibility === "public") {
      where.isPubliclyVisible = true;
    } else if (query.visibility === "hidden") {
      where.isPubliclyVisible = false;
    }
  }

  if (query.format) where.format = query.format;
  if (query.binding) where.binding = query.binding;
  if (query.authorId) where.authorId = query.authorId;
  if (query.publisherId) where.publisherId = query.publisherId;

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.purchasePrice = {};
    if (query.minPrice !== undefined) {
      where.purchasePrice.gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      where.purchasePrice.lte = query.maxPrice;
    }
  }

  if (query.minPages !== undefined || query.maxPages !== undefined) {
    where.numberOfPages = {};
    if (query.minPages !== undefined) {
      where.numberOfPages.gte = query.minPages;
    }
    if (query.maxPages !== undefined) {
      where.numberOfPages.lte = query.maxPages;
    }
  }

  if (query.yearFrom !== undefined || query.yearTo !== undefined) {
    where.yearPublished = {};
    if (query.yearFrom !== undefined) {
      where.yearPublished.gte = query.yearFrom;
    }
    if (query.yearTo !== undefined) {
      where.yearPublished.lte = query.yearTo;
    }
  }

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {};
    if (query.createdFrom) {
      const from = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
      }
    }
    if (query.createdTo) {
      const to = new Date(`${query.createdTo}T23:59:59.999Z`);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
      }
    }
  }

  return where;
}

function buildOrderBy(
  query: BookListQuery,
): Prisma.BookOrderByWithRelationInput {
  const direction = query.sortOrder;
  switch (query.sortBy) {
    case "title":
      return { title: direction };
    case "author":
      return { author: { name: direction } };
    case "publisher":
      return { publisher: { name: direction } };
    case "format":
      return { format: direction };
    case "binding":
      return { binding: direction };
    case "purchasePrice":
      return { purchasePrice: direction };
    case "marketPrice":
      return { marketPrice: direction };
    case "currency":
      return { currency: direction };
    case "numberOfPages":
      return { numberOfPages: direction };
    case "yearPublished":
      return { yearPublished: direction };
    case "isbn":
      return { isbn: direction };
    case "externalId":
      return { externalId: direction };
    case "isPubliclyVisible":
      return { isPubliclyVisible: direction };
    case "isGift":
      return { isGift: direction };
    case "createdAt":
    default:
      return { createdAt: direction };
  }
}

async function findOrCreateAuthor(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError(400, "VALIDATION_ERROR", "Author name cannot be empty");
  }
  return prisma.author.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
}

async function findOrCreatePublisher(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Publisher name cannot be empty",
    );
  }
  return prisma.publisher.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
}

async function resolveAuthorIds(
  ids: string[] = [],
  names: string[] = [],
): Promise<string[]> {
  const resolved = [...ids];
  for (const name of names) {
    const author = await findOrCreateAuthor(name);
    if (!resolved.includes(author.id)) {
      resolved.push(author.id);
    }
  }
  return resolved;
}

async function resolvePrimaryAuthorId(
  authorId?: string,
  authorName?: string,
): Promise<string> {
  if (authorId) return authorId;
  if (authorName?.trim()) {
    const author = await findOrCreateAuthor(authorName);
    return author.id;
  }
  throw new AppError(400, "VALIDATION_ERROR", "Primary author is required");
}

async function resolvePublisherId(
  publisherId?: string | null,
  publisherName?: string | null,
): Promise<string | null> {
  if (publisherId) return publisherId;
  if (publisherName?.trim()) {
    const publisher = await findOrCreatePublisher(publisherName);
    return publisher.id;
  }
  return null;
}

function bookDataFromInput(
  input: CreateBookInput | UpdateBookInput,
  authorId: string | null,
  publisherId: string | null,
): Prisma.BookUncheckedCreateInput | Prisma.BookUncheckedUpdateInput {
  const coverImageUrl =
    input.coverImageUrl === "" ? null : (input.coverImageUrl ?? undefined);

  return {
    title: input.title,
    externalId: input.externalId,
    isbn: input.isbn,
    isbn13: input.isbn13,
    purchasePrice: input.purchasePrice,
    marketPrice: input.marketPrice,
    currency: input.currency,
    format: input.format,
    binding: input.binding,
    numberOfPages: input.numberOfPages,
    yearPublished: input.yearPublished,
    originalPublicationYear: input.originalPublicationYear,
    edition: input.edition,
    isPubliclyVisible: input.isPubliclyVisible,
    isGift: input.isGift,
    toPurchase: input.toPurchase,
    coverImageUrl,
    notes: input.notes,
    authorId,
    publisherId,
  };
}

async function applyBookSearchFilter(
  where: Prisma.BookWhereInput,
  search?: string,
): Promise<Prisma.BookWhereInput> {
  if (!search?.trim()) return where;
  const ids = await findBookIdsByArabicSearch(search.trim());
  return restrictToSearchIds(where, ids);
}

export async function listBooks(
  query: BookListQuery,
  options: {
    publicOnly?: boolean;
    publicCollection?: "library" | "to_purchase";
    includePricing?: boolean;
    includeAdminFields?: boolean;
  },
) {
  const where = await applyBookSearchFilter(
    buildWhereClause(query, options),
    query.search,
  );
  const skip = (query.page - 1) * query.limit;

  const [books, totalItems] = await Promise.all([
    prisma.book.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: buildOrderBy(query),
      include: bookInclude,
    }),
    prisma.book.count({ where }),
  ]);

  return {
    books: books.map((b) =>
      serializeBook(b, {
        includePricing: options.includePricing,
        includeAdminFields: options.includeAdminFields,
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit) || 1,
    },
  };
}

async function paginateAdminBooks(
  where: Prisma.BookWhereInput,
  query: EntityBooksQuery,
) {
  const skip = (query.page - 1) * query.limit;
  const [books, totalItems] = await Promise.all([
    prisma.book.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { title: "asc" },
      include: bookInclude,
    }),
    prisma.book.count({ where }),
  ]);

  return {
    books: books.map((b) =>
      serializeBook(b, { includePricing: true, includeAdminFields: true }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit) || 1,
    },
  };
}

export async function listBooksByAuthor(authorId: string, query: EntityBooksQuery) {
  const author = await prisma.author.findUnique({
    where: { id: authorId },
    select: { id: true },
  });
  if (!author) {
    throw new AppError(404, "NOT_FOUND", "Author not found");
  }

  const where: Prisma.BookWhereInput = {
    OR: [{ authorId }, { additionalAuthors: { some: { authorId } } }],
  };
  if (query.collection) {
    where.toPurchase = query.collection === "to_purchase";
  }

  return paginateAdminBooks(where, query);
}

export async function listBooksByPublisher(
  publisherId: string,
  query: EntityBooksQuery,
) {
  const publisher = await prisma.publisher.findUnique({
    where: { id: publisherId },
    select: { id: true },
  });
  if (!publisher) {
    throw new AppError(404, "NOT_FOUND", "Publisher not found");
  }

  const where: Prisma.BookWhereInput = { publisherId };
  if (query.collection) {
    where.toPurchase = query.collection === "to_purchase";
  }

  return paginateAdminBooks(where, query);
}

export async function getBookById(
  id: string,
  options: {
    publicOnly?: boolean;
    publicCollection?: "library" | "to_purchase";
    includePricing?: boolean;
    includeAdminFields?: boolean;
  },
) {
  const book = await prisma.book.findUnique({
    where: { id },
    include: bookInclude,
  });

  if (!book) {
    throw new AppError(404, "NOT_FOUND", "Book not found");
  }

  if (options.publicOnly) {
    const collection = options.publicCollection ?? "library";
    const wrongCollection =
      collection === "to_purchase" ? !book.toPurchase : book.toPurchase;
    if (!book.isPubliclyVisible || wrongCollection) {
      throw new AppError(404, "NOT_FOUND", "Book not found");
    }
  }

  return serializeBook(book, {
    includePricing: options.includePricing,
    includeAdminFields: options.includeAdminFields,
  });
}

export async function createBook(input: CreateBookInput) {
  const authorId =
    input.toPurchase && !input.authorId && !input.authorName?.trim()
      ? null
      : await resolvePrimaryAuthorId(input.authorId, input.authorName);
  const publisherId = await resolvePublisherId(
    input.publisherId,
    input.publisherName,
  );
  const additionalAuthorIds = await resolveAuthorIds(
    input.additionalAuthorIds,
    input.additionalAuthorNames,
  );
  const data = bookDataFromInput(input, authorId, publisherId) as Prisma.BookUncheckedCreateInput;

  if (input.toPurchase) {
    data.toPurchase = true;
    data.isPubliclyVisible = input.isPubliclyVisible ?? false;
  }

  const book = await prisma.book.create({
    data: {
      ...data,
      title: input.title,
      additionalAuthors: {
        create: additionalAuthorIds.map((aid) => ({ authorId: aid })),
      },
    },
    include: bookInclude,
  });

  return serializeBook(book, {
    includePricing: true,
    includeAdminFields: true,
  });
}

export async function updateBook(id: string, input: UpdateBookInput) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Book not found");
  }

  const authorId =
    input.authorId !== undefined || input.authorName !== undefined
      ? input.authorId || input.authorName?.trim()
        ? await resolvePrimaryAuthorId(input.authorId, input.authorName)
        : null
      : existing.authorId;

  const publisherId =
    input.publisherId !== undefined || input.publisherName !== undefined
      ? await resolvePublisherId(input.publisherId, input.publisherName)
      : existing.publisherId;

  const rawData = bookDataFromInput(
    input,
    authorId,
    publisherId,
  ) as Prisma.BookUncheckedUpdateInput;
  const data = Object.fromEntries(
    Object.entries(rawData).filter(([, value]) => value !== undefined),
  ) as Prisma.BookUncheckedUpdateInput;

  if (input.additionalAuthorIds !== undefined || input.additionalAuthorNames !== undefined) {
    const additionalAuthorIds = await resolveAuthorIds(
      input.additionalAuthorIds ?? [],
      input.additionalAuthorNames ?? [],
    );
    await prisma.bookAdditionalAuthor.deleteMany({ where: { bookId: id } });
    if (additionalAuthorIds.length > 0) {
      await prisma.bookAdditionalAuthor.createMany({
        data: additionalAuthorIds.map((authorId) => ({ bookId: id, authorId })),
      });
    }
  }

  const book = await prisma.book.update({
    where: { id },
    data,
    include: bookInclude,
  });

  return serializeBook(book, {
    includePricing: true,
    includeAdminFields: true,
  });
}

export async function moveBookToLibrary(id: string, input: MoveToLibraryInput) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Book not found");
  }
  if (!existing.toPurchase) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Book is already in your library",
    );
  }

  const authorId = await resolvePrimaryAuthorId(input.authorId, input.authorName);
  const publisherId = await resolvePublisherId(
    input.publisherId,
    input.publisherName,
  );

  if (!publisherId) {
    throw new AppError(400, "VALIDATION_ERROR", "Publisher is required");
  }

  const book = await prisma.book.update({
    where: { id },
    data: {
      toPurchase: false,
      isPubliclyVisible: true,
      authorId,
      publisherId,
      numberOfPages: input.numberOfPages,
      marketPrice: input.marketPrice,
      purchasePrice: input.purchasePrice ?? null,
    },
    include: bookInclude,
  });

  return serializeBook(book, {
    includePricing: true,
    includeAdminFields: true,
  });
}

export async function deleteBook(id: string) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Book not found");
  }
  await prisma.book.delete({ where: { id } });
}

export async function setBookVisibility(id: string, isPubliclyVisible: boolean) {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Book not found");
  }

  const book = await prisma.book.update({
    where: { id },
    data: { isPubliclyVisible },
    include: bookInclude,
  });

  return serializeBook(book, {
    includePricing: true,
    includeAdminFields: true,
  });
}

export async function bulkSetVisibility(
  ids: string[],
  isPubliclyVisible: boolean,
) {
  const result = await prisma.book.updateMany({
    where: { id: { in: ids } },
    data: { isPubliclyVisible },
  });
  return { updated: result.count };
}

export async function bulkDeleteBooks(ids: string[]) {
  const result = await prisma.book.deleteMany({
    where: { id: { in: ids } },
  });
  return { deleted: result.count };
}

export async function listPublicAuthors() {
  return prisma.author.findMany({
    where: {
      OR: [
        { booksAsPrimary: { some: { isPubliclyVisible: true } } },
        {
          booksAsAdditional: {
            some: { book: { isPubliclyVisible: true } },
          },
        },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listPublicPublishers() {
  return prisma.publisher.findMany({
    where: { books: { some: { isPubliclyVisible: true } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

function missingCoverWhere(): Prisma.BookWhereInput {
  return {
    OR: [{ coverImageUrl: null }, { coverImageUrl: "" }],
  };
}

async function bookIdsWithInvalidIsbn13(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Book"
    WHERE "isbn13" IS NOT NULL AND trim("isbn13") != ''
    AND length(regexp_replace("isbn13", '[^0-9]', '', 'g')) != 13
  `;
  return rows.map((row) => row.id);
}

function missingIsbnWhere(invalidIsbnBookIds: string[] = []): Prisma.BookWhereInput {
  const or: Prisma.BookWhereInput[] = [{ isbn13: null }, { isbn13: "" }];
  if (invalidIsbnBookIds.length > 0) {
    or.push({ id: { in: invalidIsbnBookIds } });
  }
  return { OR: or };
}

function missingMarketPriceWhere(): Prisma.BookWhereInput {
  return { marketPrice: null };
}

function missingInfoWhere(invalidIsbnBookIds: string[] = []): Prisma.BookWhereInput {
  return {
    OR: [
      ...missingCoverWhere().OR!,
      ...missingIsbnWhere(invalidIsbnBookIds).OR!,
      missingMarketPriceWhere(),
    ],
  };
}

function collectionWhere(
  collection:
    | MissingInfoQuery["collection"]
    | BulkFetchCoversInput["collection"]
    | BulkFetchIsbnInput["collection"]
    | BulkFetchMarketPriceInput["collection"],
): Prisma.BookWhereInput {
  if (collection === "library") return { toPurchase: false };
  if (collection === "to_purchase") return { toPurchase: true };
  return {};
}

async function buildMissingInfoWhere(
  query: Pick<MissingInfoQuery, "collection" | "search">,
): Promise<Prisma.BookWhereInput> {
  const invalidIsbnBookIds = await bookIdsWithInvalidIsbn13();
  const where: Prisma.BookWhereInput = {
    ...missingInfoWhere(invalidIsbnBookIds),
    ...collectionWhere(query.collection),
  };

  if (query.search?.trim()) {
    const ids = await findBookIdsByArabicSearch(query.search.trim());
    return restrictToSearchIds(where, ids);
  }

  return where;
}

type MissingInfoRow = {
  externalId: string | null;
  coverImageUrl: string | null;
  isbn13: string | null;
  marketPrice: Prisma.Decimal | null;
};

function summarizeMissingInfoRows(rows: MissingInfoRow[]) {
  let missingCover = 0;
  let missingIsbn13 = 0;
  let missingMarketPrice = 0;
  let canFetchFromGoodreads = 0;
  let canFetchPrice = 0;

  for (const row of rows) {
    const lacksCover = !row.coverImageUrl?.trim();
    const lacksIsbn = needsIsbn13(row.isbn13);
    const lacksPrice = row.marketPrice == null;
    if (lacksCover) missingCover += 1;
    if (lacksIsbn) missingIsbn13 += 1;
    if (lacksPrice) missingMarketPrice += 1;

    const hasGoodreadsId = goodreadsService.isValidGoodreadsBookId(row.externalId);
    if (hasGoodreadsId && (lacksCover || lacksIsbn)) {
      canFetchFromGoodreads += 1;
    }
    if (isValidIsbn13(row.isbn13) && lacksPrice) {
      canFetchPrice += 1;
    }
  }

  const withGoodreadsId = rows.filter((row) =>
    goodreadsService.isValidGoodreadsBookId(row.externalId),
  ).length;

  return {
    totalMissing: rows.length,
    missingCover,
    missingIsbn13,
    missingMarketPrice,
    withGoodreadsId,
    withoutGoodreadsId: rows.length - withGoodreadsId,
    canFetchFromGoodreads,
    canFetchPrice,
  };
}

export async function getMissingInfoSummary(
  collection: MissingInfoQuery["collection"] = "all",
) {
  const invalidIsbnBookIds = await bookIdsWithInvalidIsbn13();
  const rows = await prisma.book.findMany({
    where: { ...missingInfoWhere(invalidIsbnBookIds), ...collectionWhere(collection) },
    select: {
      externalId: true,
      coverImageUrl: true,
      isbn13: true,
      marketPrice: true,
    },
  });

  return summarizeMissingInfoRows(rows);
}

export async function listBooksMissingInfo(query: MissingInfoQuery) {
  const where = await buildMissingInfoWhere(query);

  if (query.withGoodreadsIdOnly) {
    const all = await prisma.book.findMany({
      where,
      orderBy: { title: "asc" },
      include: bookInclude,
    });
    const filtered = all.filter((b) =>
      goodreadsService.isValidGoodreadsBookId(b.externalId),
    );
    const skip = (query.page - 1) * query.limit;
    const page = filtered.slice(skip, skip + query.limit);
    return {
      books: page.map((b) =>
        serializeBook(b, { includePricing: true, includeAdminFields: true }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / query.limit) || 1,
      },
    };
  }

  const skip = (query.page - 1) * query.limit;
  const [books, totalItems] = await Promise.all([
    prisma.book.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { title: "asc" },
      include: bookInclude,
    }),
    prisma.book.count({ where }),
  ]);

  return {
    books: books.map((b) =>
      serializeBook(b, { includePricing: true, includeAdminFields: true }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit) || 1,
    },
  };
}

const BULK_FETCH_DELAY_MS = 800;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BulkFetchProgressUpdate {
  current: number;
  total: number;
  updated: number;
  failed: number;
  currentTitle: string | null;
}

export type BulkFetchProgressCallback = (
  update: BulkFetchProgressUpdate,
) => void;

function reportBulkFetchProgress(
  onProgress: BulkFetchProgressCallback | undefined,
  index: number,
  total: number,
  updated: number,
  failed: number,
  currentTitle: string | null,
) {
  onProgress?.({
    current: index,
    total,
    updated,
    failed,
    currentTitle,
  });
}

export async function bulkFetchGoodreadsCovers(
  input: BulkFetchCoversInput,
  onProgress?: BulkFetchProgressCallback,
) {
  let books: { id: string; title: string; externalId: string | null }[];

  if (input.bookIds?.length) {
    books = await prisma.book.findMany({
      where: {
        id: { in: input.bookIds },
        ...missingCoverWhere(),
      },
      select: { id: true, title: true, externalId: true },
      orderBy: { title: "asc" },
    });
  } else {
    const where: Prisma.BookWhereInput = {
      ...missingCoverWhere(),
      ...collectionWhere(input.collection),
    };
    books = await prisma.book.findMany({
      where,
      select: { id: true, title: true, externalId: true },
      orderBy: { title: "asc" },
    });
  }

  const targets = input.onlyWithGoodreadsId
    ? books.filter((b) => goodreadsService.isValidGoodreadsBookId(b.externalId))
    : books;

  const report = {
    attempted: targets.length,
    updated: 0,
    skipped: 0,
    failed: [] as { id: string; title: string; message: string }[],
  };

  reportBulkFetchProgress(onProgress, 0, targets.length, 0, 0, null);

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    const bookId = book.externalId?.trim();

    if (!goodreadsService.isValidGoodreadsBookId(bookId)) {
      report.skipped++;
      reportBulkFetchProgress(
        onProgress,
        i + 1,
        targets.length,
        report.updated,
        report.failed.length,
        book.title,
      );
      continue;
    }

    try {
      const coverUrl = await goodreadsService.fetchCoverUrlByBookId(bookId!);
      await prisma.book.update({
        where: { id: book.id },
        data: { coverImageUrl: coverUrl },
      });
      report.updated++;
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      report.failed.push({ id: book.id, title: book.title, message });
    }

    reportBulkFetchProgress(
      onProgress,
      i + 1,
      targets.length,
      report.updated,
      report.failed.length,
      book.title,
    );

    if (i < targets.length - 1) {
      await delay(BULK_FETCH_DELAY_MS);
    }
  }

  return report;
}

export async function bulkFetchIsbn13FromGoodreads(
  input: BulkFetchIsbnInput,
  onProgress?: BulkFetchProgressCallback,
) {
  const invalidIsbnBookIds = await bookIdsWithInvalidIsbn13();
  const isbnWhere = missingIsbnWhere(invalidIsbnBookIds);

  let books: {
    id: string;
    title: string;
    externalId: string | null;
    isbn13: string | null;
  }[];

  if (input.bookIds?.length) {
    books = await prisma.book.findMany({
      where: {
        id: { in: input.bookIds },
        ...isbnWhere,
      },
      select: { id: true, title: true, externalId: true, isbn13: true },
      orderBy: { title: "asc" },
    });
  } else {
    books = await prisma.book.findMany({
      where: {
        ...isbnWhere,
        ...collectionWhere(input.collection),
      },
      select: { id: true, title: true, externalId: true, isbn13: true },
      orderBy: { title: "asc" },
    });
  }

  const targets = (
    input.onlyWithGoodreadsId
      ? books.filter((b) => goodreadsService.isValidGoodreadsBookId(b.externalId))
      : books
  ).filter((b) => needsIsbn13(b.isbn13));

  const report = {
    attempted: targets.length,
    updated: 0,
    skipped: 0,
    failed: [] as { id: string; title: string; message: string }[],
  };

  reportBulkFetchProgress(onProgress, 0, targets.length, 0, 0, null);

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    const goodreadsId = book.externalId?.trim();

    if (!goodreadsService.isValidGoodreadsBookId(goodreadsId)) {
      report.skipped += 1;
      reportBulkFetchProgress(
        onProgress,
        i + 1,
        targets.length,
        report.updated,
        report.failed.length,
        book.title,
      );
      continue;
    }

    try {
      const data = await goodreadsService.fetchBookDataByBookId(goodreadsId!);
      if (!data.isbn13) {
        report.failed.push({
          id: book.id,
          title: book.title,
          message: "Goodreads did not return an ISBN-13",
        });
      } else {
        await prisma.book.update({
          where: { id: book.id },
          data: { isbn13: data.isbn13 },
        });
        report.updated += 1;
      }
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      report.failed.push({ id: book.id, title: book.title, message });
    }

    reportBulkFetchProgress(
      onProgress,
      i + 1,
      targets.length,
      report.updated,
      report.failed.length,
      book.title,
    );

    if (i < targets.length - 1) {
      await delay(BULK_FETCH_DELAY_MS);
    }
  }

  return report;
}

export async function bulkFetchMarketPriceFromAseeralkotb(
  input: BulkFetchMarketPriceInput,
  onProgress?: BulkFetchProgressCallback,
) {
  let books: {
    id: string;
    title: string;
    isbn13: string | null;
    marketPrice: Prisma.Decimal | null;
  }[];

  if (input.bookIds?.length) {
    books = await prisma.book.findMany({
      where: {
        id: { in: input.bookIds },
        ...missingMarketPriceWhere(),
      },
      select: { id: true, title: true, isbn13: true, marketPrice: true },
      orderBy: { title: "asc" },
    });
  } else {
    books = await prisma.book.findMany({
      where: {
        ...missingMarketPriceWhere(),
        ...collectionWhere(input.collection),
      },
      select: { id: true, title: true, isbn13: true, marketPrice: true },
      orderBy: { title: "asc" },
    });
  }

  const targets = input.onlyWithIsbn13
    ? books.filter((b) => isValidIsbn13(b.isbn13))
    : books;

  const report = {
    attempted: targets.length,
    updated: 0,
    skipped: 0,
    failed: [] as { id: string; title: string; message: string }[],
  };

  reportBulkFetchProgress(onProgress, 0, targets.length, 0, 0, null);

  for (let i = 0; i < targets.length; i++) {
    const book = targets[i];
    const isbn13 = book.isbn13?.trim();

    if (!isValidIsbn13(isbn13)) {
      report.skipped += 1;
      reportBulkFetchProgress(
        onProgress,
        i + 1,
        targets.length,
        report.updated,
        report.failed.length,
        book.title,
      );
      continue;
    }

    try {
      const price = await aseeralkotbService.lookupMarketPriceByIsbn13(isbn13!, {
        titleFallback: book.title,
      });
      await prisma.book.update({
        where: { id: book.id },
        data: { marketPrice: price.marketPrice },
      });
      report.updated += 1;
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      report.failed.push({ id: book.id, title: book.title, message });
    }

    reportBulkFetchProgress(
      onProgress,
      i + 1,
      targets.length,
      report.updated,
      report.failed.length,
      book.title,
    );

    if (i < targets.length - 1) {
      await delay(BULK_FETCH_DELAY_MS);
    }
  }

  return report;
}
