import { prisma } from "../lib/prisma.js";

export async function listAuthors(search?: string) {
  return prisma.author.findMany({
    where: search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function listPublishers(search?: string) {
  return prisma.publisher.findMany({
    where: search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function listBookshelves(search?: string) {
  return prisma.bookshelf.findMany({
    where: search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}
