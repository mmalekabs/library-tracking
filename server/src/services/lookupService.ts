import { prisma } from "../lib/prisma.js";
import {
  findAuthorIdsByArabicSearch,
  findBookshelfIdsByArabicSearch,
  findPublisherIdsByArabicSearch,
  idsWhere,
} from "../utils/arabicSearch.js";

export async function listAuthors(search?: string) {
  let where: { id: { in: string[] } } | undefined;
  if (search?.trim()) {
    const ids = await findAuthorIdsByArabicSearch(search.trim());
    where = idsWhere(ids);
  }
  return prisma.author.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function listPublishers(search?: string) {
  let where: { id: { in: string[] } } | undefined;
  if (search?.trim()) {
    const ids = await findPublisherIdsByArabicSearch(search.trim());
    where = idsWhere(ids);
  }
  return prisma.publisher.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function listBookshelves(search?: string) {
  let where: { id: { in: string[] } } | undefined;
  if (search?.trim()) {
    const ids = await findBookshelfIdsByArabicSearch(search.trim());
    where = idsWhere(ids);
  }
  return prisma.bookshelf.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}
