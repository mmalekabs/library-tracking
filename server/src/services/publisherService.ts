import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export async function listPublishersAdmin(search?: string) {
  const publishers = await prisma.publisher.findMany({
    where: search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : undefined,
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { books: true } },
    },
    orderBy: { name: "asc" },
  });

  return publishers.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    bookCount: p._count.books,
  }));
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
