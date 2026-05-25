import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { calculateSavings, decimalToNumber } from "../utils/book.js";
import type {
  BookListQuery,
  CreateBookInput,
  UpdateBookInput,
} from "../validators/book.js";

export const bookInclude = {
  author: { select: { id: true, name: true } },
  additionalAuthors: {
    include: { author: { select: { id: true, name: true } } },
  },
  publisher: { select: { id: true, name: true } },
  bookshelves: {
    include: { bookshelf: { select: { id: true, name: true } } },
  },
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
    status: book.status,
    dateAdded: book.dateAdded.toISOString(),
    dateStartedReading: book.dateStartedReading?.toISOString() ?? null,
    dateFinishedReading: book.dateFinishedReading?.toISOString() ?? null,
    coverImageUrl: book.coverImageUrl,
    author: book.author,
    additionalAuthors: book.additionalAuthors.map((aa) => aa.author),
    publisher: book.publisher,
    bookshelves: book.bookshelves.map((bb) => bb.bookshelf),
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
  if (query.status) where.status = query.status;
  if (query.binding) where.binding = query.binding;
  if (query.authorId) where.authorId = query.authorId;
  if (query.publisherId) where.publisherId = query.publisherId;
  if (query.bookshelfId) {
    where.bookshelves = { some: { bookshelfId: query.bookshelfId } };
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { isbn: { contains: term, mode: "insensitive" } },
      { isbn13: { contains: term, mode: "insensitive" } },
      { author: { name: { contains: term, mode: "insensitive" } } },
    ];
  }

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

  return where;
}

function buildOrderBy(
  query: BookListQuery,
): Prisma.BookOrderByWithRelationInput {
  const direction = query.sortOrder;
  switch (query.sortBy) {
    case "title":
      return { title: direction };
    case "purchasePrice":
      return { purchasePrice: direction };
    case "numberOfPages":
      return { numberOfPages: direction };
    case "yearPublished":
      return { yearPublished: direction };
    case "dateAdded":
    default:
      return { dateAdded: direction };
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

async function resolveBookshelfIds(
  ids: string[] = [],
  names: string[] = [],
): Promise<string[]> {
  const resolved = [...ids];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const shelf = await prisma.bookshelf.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    if (!resolved.includes(shelf.id)) {
      resolved.push(shelf.id);
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
  authorId: string,
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
    status: input.status,
    dateAdded: input.dateAdded ?? undefined,
    dateStartedReading: input.dateStartedReading,
    dateFinishedReading: input.dateFinishedReading,
    isPubliclyVisible: input.isPubliclyVisible,
    toPurchase: input.toPurchase,
    coverImageUrl,
    notes: input.notes,
    authorId,
    publisherId,
  };
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
  const where = buildWhereClause(query, options);
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
  const authorId = await resolvePrimaryAuthorId(input.authorId, input.authorName);
  const publisherId = await resolvePublisherId(
    input.publisherId,
    input.publisherName,
  );
  const additionalAuthorIds = await resolveAuthorIds(
    input.additionalAuthorIds,
    input.additionalAuthorNames,
  );
  const bookshelfIds = await resolveBookshelfIds(
    input.bookshelfIds,
    input.bookshelfNames,
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
      bookshelves: {
        create: bookshelfIds.map((sid) => ({ bookshelfId: sid })),
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
      ? await resolvePrimaryAuthorId(input.authorId, input.authorName)
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

  if (input.bookshelfIds !== undefined || input.bookshelfNames !== undefined) {
    const bookshelfIds = await resolveBookshelfIds(
      input.bookshelfIds ?? [],
      input.bookshelfNames ?? [],
    );
    await prisma.bookBookshelf.deleteMany({ where: { bookId: id } });
    if (bookshelfIds.length > 0) {
      await prisma.bookBookshelf.createMany({
        data: bookshelfIds.map((bookshelfId) => ({ bookId: id, bookshelfId })),
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

export async function listPublicBookshelves() {
  return prisma.bookshelf.findMany({
    where: { books: { some: { book: { isPubliclyVisible: true } } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
