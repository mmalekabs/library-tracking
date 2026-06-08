import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import type { EntityListQuery } from "../validators/entity.js";
import {
  collectionToPurchase,
  sortEntities,
} from "./entityListUtils.js";

export async function listAuthorsAdmin(query: EntityListQuery) {
  const toPurchase = collectionToPurchase(query.collection);
  const authors = await prisma.author.findMany({
    where: query.search?.trim()
      ? { name: { contains: query.search.trim(), mode: "insensitive" } }
      : undefined,
    select: {
      id: true,
      name: true,
      createdAt: true,
      booksAsPrimary: {
        where: { toPurchase },
        select: { id: true },
      },
      booksAsAdditional: {
        where: { book: { toPurchase } },
        select: { bookId: true },
      },
    },
  });

  const mapped = authors
    .map((a) => {
      const bookIds = new Set([
        ...a.booksAsPrimary.map((b) => b.id),
        ...a.booksAsAdditional.map((aa) => aa.bookId),
      ]);
      return {
        id: a.id,
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        bookCount: bookIds.size,
        primaryBookCount: a.booksAsPrimary.length,
      };
    })
    .filter((a) => a.bookCount > 0);

  return sortEntities(mapped, query);
}

export async function createAuthor(name: string) {
  const trimmed = name.trim();
  try {
    const author = await prisma.author.create({
      data: { name: trimmed },
      select: { id: true, name: true, createdAt: true },
    });
    return {
      id: author.id,
      name: author.name,
      createdAt: author.createdAt.toISOString(),
      bookCount: 0,
      primaryBookCount: 0,
    };
  } catch {
    throw new AppError(409, "DUPLICATE", "An author with this name already exists");
  }
}

export async function updateAuthor(id: string, name: string) {
  const existing = await prisma.author.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Author not found");
  }

  try {
    const author = await prisma.author.update({
      where: { id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { booksAsPrimary: true, booksAsAdditional: true } },
      },
    });
    return {
      id: author.id,
      name: author.name,
      createdAt: author.createdAt.toISOString(),
      bookCount:
        author._count.booksAsPrimary + author._count.booksAsAdditional,
      primaryBookCount: author._count.booksAsPrimary,
    };
  } catch {
    throw new AppError(409, "DUPLICATE", "An author with this name already exists");
  }
}

export async function deleteAuthor(id: string) {
  const author = await prisma.author.findUnique({
    where: { id },
    include: {
      _count: { select: { booksAsPrimary: true, booksAsAdditional: true } },
    },
  });

  if (!author) {
    throw new AppError(404, "NOT_FOUND", "Author not found");
  }

  const bookCount =
    author._count.booksAsPrimary + author._count.booksAsAdditional;

  if (bookCount > 0) {
    throw new AppError(
      409,
      "HAS_BOOKS",
      `Cannot delete author with ${bookCount} linked book(s). Reassign or delete those books first.`,
      { bookCount },
    );
  }

  await prisma.author.delete({ where: { id } });
}

export async function mergeAuthors(targetId: string, sourceIds: string[]) {
  const uniqueSources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (uniqueSources.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "At least one source author is required (other than the target)",
    );
  }

  const target = await prisma.author.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError(404, "NOT_FOUND", "Target author not found");
  }

  const sources = await prisma.author.findMany({
    where: { id: { in: uniqueSources } },
    select: { id: true, name: true },
  });

  if (sources.length !== uniqueSources.length) {
    throw new AppError(404, "NOT_FOUND", "One or more source authors not found");
  }

  let primaryBooksUpdated = 0;
  let additionalLinksUpdated = 0;

  await prisma.$transaction(async (tx) => {
    for (const sourceId of uniqueSources) {
      const primaryResult = await tx.book.updateMany({
        where: { authorId: sourceId },
        data: { authorId: targetId },
      });
      primaryBooksUpdated += primaryResult.count;

      const additionalLinks = await tx.bookAdditionalAuthor.findMany({
        where: { authorId: sourceId },
      });

      for (const link of additionalLinks) {
        const duplicate = await tx.bookAdditionalAuthor.findUnique({
          where: {
            bookId_authorId: { bookId: link.bookId, authorId: targetId },
          },
        });

        if (duplicate) {
          await tx.bookAdditionalAuthor.delete({
            where: {
              bookId_authorId: { bookId: link.bookId, authorId: sourceId },
            },
          });
        } else {
          await tx.bookAdditionalAuthor.update({
            where: {
              bookId_authorId: { bookId: link.bookId, authorId: sourceId },
            },
            data: { authorId: targetId },
          });
          additionalLinksUpdated += 1;
        }
      }
    }

    const primaryBookIds = await tx.book.findMany({
      where: { authorId: targetId },
      select: { id: true },
    });

    if (primaryBookIds.length > 0) {
      await tx.bookAdditionalAuthor.deleteMany({
        where: {
          authorId: targetId,
          bookId: { in: primaryBookIds.map((b) => b.id) },
        },
      });
    }

    await tx.author.deleteMany({ where: { id: { in: uniqueSources } } });
  });

  const targetAfter = await prisma.author.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { booksAsPrimary: true, booksAsAdditional: true } },
    },
  });

  return {
    target: {
      id: targetAfter!.id,
      name: targetAfter!.name,
      createdAt: targetAfter!.createdAt.toISOString(),
      bookCount:
        targetAfter!._count.booksAsPrimary +
        targetAfter!._count.booksAsAdditional,
      primaryBookCount: targetAfter!._count.booksAsPrimary,
    },
    mergedCount: uniqueSources.length,
    primaryBooksUpdated,
    additionalLinksUpdated,
    mergedNames: sources.map((s) => s.name),
  };
}
