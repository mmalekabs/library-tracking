import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** Strip tashkeel / tatweel and normalize common Arabic letter variants for search. */
export function normalizeArabicForSearch(text: string): string {
  return text
    .normalize("NFC")
    .replace(
      /[\u064B-\u065F\u0670\u0640\u0610-\u061A\u06D6-\u06ED\u08D3-\u08FF]/g,
      "",
    )
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function arabicSearchLikePattern(term: string): string {
  return `%${escapeLikePattern(normalizeArabicForSearch(term))}%`;
}

/** PostgreSQL expression: normalize a text column for Arabic-insensitive LIKE. */
export function sqlNormalizeArabic(columnRef: string): string {
  return `lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(COALESCE(${columnRef}, ''), '[ًٌٍَُِّْٰٕٖٓٔـۖ-ۭ]', '', 'g'),
                'أ', 'ا', 'g'),
              'إ', 'ا', 'g'),
            'آ', 'ا', 'g'),
          'ٱ', 'ا', 'g'),
        'ؤ', 'و', 'g'),
      'ئ', 'ي', 'g'),
    'ى', 'ي', 'g')
  )`;
}

function columnArabicIlike(columnRef: string, pattern: string): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(sqlNormalizeArabic(columnRef))} LIKE ${pattern} ESCAPE '\\'`;
}

export async function findBookIdsByArabicSearch(term: string): Promise<string[]> {
  const pattern = arabicSearchLikePattern(term);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT b.id
    FROM "Book" b
    LEFT JOIN "Author" a ON b."authorId" = a.id
    WHERE
      ${columnArabicIlike("b.title", pattern)}
      OR ${columnArabicIlike("b.isbn", pattern)}
      OR ${columnArabicIlike('b."isbn13"', pattern)}
      OR ${columnArabicIlike("a.name", pattern)}
      OR lower(COALESCE(b."externalId", '')) LIKE ${pattern} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
}

export async function findAuthorIdsByArabicSearch(term: string): Promise<string[]> {
  const pattern = arabicSearchLikePattern(term);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Author"
    WHERE ${columnArabicIlike("name", pattern)}
  `;
  return rows.map((row) => row.id);
}

export async function findPublisherIdsByArabicSearch(
  term: string,
): Promise<string[]> {
  const pattern = arabicSearchLikePattern(term);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Publisher"
    WHERE ${columnArabicIlike("name", pattern)}
  `;
  return rows.map((row) => row.id);
}

export async function findBookshelfIdsByArabicSearch(
  term: string,
): Promise<string[]> {
  const pattern = arabicSearchLikePattern(term);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Bookshelf"
    WHERE ${columnArabicIlike("name", pattern)}
  `;
  return rows.map((row) => row.id);
}

export function idsWhere(ids: string[]): { id: { in: string[] } } {
  return { id: { in: ids } };
}

/** Restrict a Prisma where clause to rows whose id matches Arabic-normalized search. */
export function restrictToSearchIds<T extends Record<string, unknown>>(
  where: T,
  ids: string[],
): T & { AND: [T, { id: { in: string[] } }] } {
  return { ...where, AND: [where, idsWhere(ids)] };
}
