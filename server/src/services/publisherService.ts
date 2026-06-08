import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import type { EntityListQuery } from "../validators/entity.js";
import {
  collectionToPurchase,
  sortEntities,
} from "./entityListUtils.js";

export async function listPublishersAdmin(query: EntityListQuery) {
  const toPurchase = collectionToPurchase(query.collection);
  const publishers = await prisma.publisher.findMany({
    where: query.search?.trim()
      ? { name: { contains: query.search.trim(), mode: "insensitive" } }
      : undefined,
    select: {
      id: true,
      name: true,
      createdAt: true,
      books: {
        where: { toPurchase },
        select: { id: true },
      },
    },
  });

  const mapped = publishers
    .map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      bookCount: p.books.length,
    }))
    .filter((p) => p.bookCount > 0);

  return sortEntities(mapped, query);
}

export async function createPublisher(name: string) {
  const trimmed = name.trim();
  try {
    const publisher = await prisma.publisher.create({
      data: { name: trimmed },
      select: { id: true, name: true, createdAt: true },
    });
    return {
      id: publisher.id,
      name: publisher.name,
      createdAt: publisher.createdAt.toISOString(),
      bookCount: 0,
    };
  } catch {
    throw new AppError(
      409,
      "DUPLICATE",
      "A publisher with this name already exists",
    );
  }
}

export async function updatePublisher(id: string, name: string) {
  const existing = await prisma.publisher.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Publisher not found");
  }

  try {
    const publisher = await prisma.publisher.update({
      where: { id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { books: true } },
      },
    });
    return {
      id: publisher.id,
      name: publisher.name,
      createdAt: publisher.createdAt.toISOString(),
      bookCount: publisher._count.books,
    };
  } catch {
    throw new AppError(
      409,
      "DUPLICATE",
      "A publisher with this name already exists",
    );
  }
}

export async function deletePublisher(id: string) {
  const publisher = await prisma.publisher.findUnique({
    where: { id },
    include: { _count: { select: { books: true } } },
  });

  if (!publisher) {
    throw new AppError(404, "NOT_FOUND", "Publisher not found");
  }

  if (publisher._count.books > 0) {
    throw new AppError(
      409,
      "HAS_BOOKS",
      `Cannot delete publisher with ${publisher._count.books} linked book(s). Reassign or remove the publisher from those books first.`,
      { bookCount: publisher._count.books },
    );
  }

  await prisma.publisher.delete({ where: { id } });
}

export async function mergePublishers(targetId: string, sourceIds: string[]) {
  const uniqueSources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (uniqueSources.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "At least one source publisher is required (other than the target)",
    );
  }

  const target = await prisma.publisher.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError(404, "NOT_FOUND", "Target publisher not found");
  }

  const sources = await prisma.publisher.findMany({
    where: { id: { in: uniqueSources } },
    select: { id: true, name: true },
  });

  if (sources.length !== uniqueSources.length) {
    throw new AppError(404, "NOT_FOUND", "One or more source publishers not found");
  }

  let booksUpdated = 0;

  await prisma.$transaction(async (tx) => {
    for (const sourceId of uniqueSources) {
      const result = await tx.book.updateMany({
        where: { publisherId: sourceId },
        data: { publisherId: targetId },
      });
      booksUpdated += result.count;
    }

    await tx.publisher.deleteMany({ where: { id: { in: uniqueSources } } });
  });

  const targetAfter = await prisma.publisher.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { books: true } },
    },
  });

  return {
    target: {
      id: targetAfter!.id,
      name: targetAfter!.name,
      createdAt: targetAfter!.createdAt.toISOString(),
      bookCount: targetAfter!._count.books,
    },
    mergedCount: uniqueSources.length,
    booksUpdated,
    mergedNames: sources.map((s) => s.name),
  };
}
