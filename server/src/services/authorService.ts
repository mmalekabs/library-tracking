import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export async function listAuthorsAdmin(search?: string) {
  const authors = await prisma.author.findMany({
    where: search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : undefined,
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          booksAsPrimary: true,
          booksAsAdditional: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return authors.map((a) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt.toISOString(),
    bookCount: a._count.booksAsPrimary + a._count.booksAsAdditional,
    primaryBookCount: a._count.booksAsPrimary,
  }));
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
