import type { BindingType, BookFormat } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../lib/prisma.js";

const GOODREADS_BOOK_URL = "https://www.goodreads.com/book/show";
const FETCH_TIMEOUT_MS = 15_000;

const OG_IMAGE_PATTERNS = [
  /property="og:image"\s+content="([^"]+)"/i,
  /property='og:image'\s+content='([^']+)'/i,
  /name="twitter:image"\s+content="([^"]+)"/i,
];

export interface GoodreadsBookData {
  goodreadsBookId: string;
  goodreadsUrl: string;
  title: string;
  authorName: string | null;
  additionalAuthorNames: string[];
  coverImageUrl: string | null;
  isbn: string | null;
  isbn13: string | null;
  numberOfPages: number | null;
  yearPublished: number | null;
  originalPublicationYear: number | null;
  publisherName: string | null;
  binding: BindingType;
  format: BookFormat;
  bookFormatLabel: string | null;
  description: string | null;
  language: string | null;
  existingBook: { id: string; title: string; readingOnly: boolean } | null;
}

export function isValidGoodreadsBookId(
  externalId: string | null | undefined,
): boolean {
  return !!externalId?.trim() && /^\d+$/.test(externalId.trim());
}

export function parseGoodreadsBookId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;

  const urlMatch = trimmed.match(/goodreads\.com\/book\/show\/(\d+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  return null;
}

export function goodreadsBookUrl(bookId: string): string {
  return `${GOODREADS_BOOK_URL}/${bookId.trim()}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isPlaceholderCover(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("no-cover") || lower.includes("/default/");
}

async function fetchGoodreadsHtml(bookId: string): Promise<string> {
  const pageUrl = goodreadsBookUrl(bookId);
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PersonalLibraryTracker/1.0; +book-lookup)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError(
      502,
      "GOODREADS_UNAVAILABLE",
      `Could not load Goodreads page (HTTP ${response.status})`,
    );
  }

  return response.text();
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`property="${property}"\\s+content="([^"]+)"`, "i"),
    new RegExp(`property='${property}'\\s+content='([^']+)'`, "i"),
    new RegExp(`name="${property}"\\s+content="([^"]+)"`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function extractTestId(html: string, testId: string): string | null {
  const match = html.match(
    new RegExp(`data-testid="${testId}"[^>]*>([^<]+)<`, "i"),
  );
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

interface JsonLdBook {
  name?: string;
  image?: string;
  bookFormat?: string;
  numberOfPages?: number;
  inLanguage?: string;
  isbn?: string;
  author?: { name?: string } | { name?: string }[];
  description?: string;
}

function parseJsonLdBook(html: string): JsonLdBook | null {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as JsonLdBook;
  } catch {
    return null;
  }
}

function splitIsbn(isbn: string | undefined | null): {
  isbn: string | null;
  isbn13: string | null;
} {
  if (!isbn) return { isbn: null, isbn13: null };
  const cleaned = isbn.replace(/[^0-9X]/gi, "");
  if (cleaned.length === 13) return { isbn: null, isbn13: cleaned };
  if (cleaned.length === 10) return { isbn: cleaned, isbn13: null };
  return { isbn: cleaned || null, isbn13: null };
}

function parsePublicationYear(publicationInfo: string | null): number | null {
  if (!publicationInfo) return null;
  const match = publicationInfo.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function mapBinding(bookFormat: string | null | undefined): BindingType {
  const value = bookFormat?.toLowerCase() ?? "";
  if (value.includes("hardcover")) return "HARDCOVER";
  if (value.includes("mass market")) return "MASS_MARKET_PAPERBACK";
  if (value.includes("paperback")) return "PAPERBACK";
  if (value.includes("kindle")) return "KINDLE_EDITION";
  return "UNKNOWN";
}

function mapFormat(bookFormat: string | null | undefined): BookFormat {
  const value = bookFormat?.toLowerCase() ?? "";
  if (value.includes("audio")) return "AUDIO";
  if (value.includes("kindle") || value.includes("ebook")) return "DIGITAL";
  return "PHYSICAL";
}

function parseAuthors(
  authors: JsonLdBook["author"],
): { primary: string | null; additional: string[] } {
  if (!authors) return { primary: null, additional: [] };
  const list = Array.isArray(authors) ? authors : [authors];
  const names = list
    .map((a) => a?.name?.trim())
    .filter((name): name is string => !!name);
  return {
    primary: names[0] ?? null,
    additional: names.slice(1),
  };
}

function extractCoverUrl(html: string, jsonLdImage?: string): string | null {
  if (jsonLdImage && !isPlaceholderCover(jsonLdImage)) {
    return jsonLdImage;
  }

  for (const pattern of OG_IMAGE_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = decodeHtmlEntities(match[1].trim());
      if (!isPlaceholderCover(url)) return url;
    }
  }

  return null;
}

function parseBookDataFromHtml(
  html: string,
  bookId: string,
): Omit<GoodreadsBookData, "existingBook"> {
  const jsonLd = parseJsonLdBook(html);
  const pagesFormat = extractTestId(html, "pagesFormat");
  const publicationInfo = extractTestId(html, "publicationInfo");
  const publisherMatch = html.match(
    /data-testid="publisher"[^>]*>([^<]+)</i,
  );
  const publisherLinkMatch = html.match(
    /<a[^>]+href="\/publisher\/show\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  );

  const formatLabel =
    jsonLd?.bookFormat ??
    (pagesFormat?.includes(",")
      ? pagesFormat.split(",").slice(1).join(",").trim()
      : null);

  const { isbn, isbn13 } = splitIsbn(jsonLd?.isbn);
  const authors = parseAuthors(jsonLd?.author);
  const year = parsePublicationYear(publicationInfo);

  const pagesFromText = pagesFormat?.match(/(\d+)\s*pages/i);
  const numberOfPages =
    jsonLd?.numberOfPages ??
    (pagesFromText ? Number.parseInt(pagesFromText[1], 10) : null);

  return {
    goodreadsBookId: bookId,
    goodreadsUrl: goodreadsBookUrl(bookId),
    title: jsonLd?.name ?? extractMetaContent(html, "og:title") ?? "Unknown title",
    authorName: authors.primary,
    additionalAuthorNames: authors.additional,
    coverImageUrl: extractCoverUrl(html, jsonLd?.image),
    isbn,
    isbn13,
    numberOfPages,
    yearPublished: year,
    originalPublicationYear: year,
    publisherName:
      (publisherMatch?.[1] ? decodeHtmlEntities(publisherMatch[1].trim()) : null) ??
      (publisherLinkMatch?.[1]
        ? decodeHtmlEntities(publisherLinkMatch[1].trim())
        : null),
    binding: mapBinding(formatLabel),
    format: mapFormat(formatLabel),
    bookFormatLabel: formatLabel,
    description:
      jsonLd?.description ??
      extractMetaContent(html, "og:description") ??
      extractMetaContent(html, "description"),
    language: jsonLd?.inLanguage ?? null,
  };
}

export async function fetchCoverUrlByBookId(bookId: string): Promise<string> {
  const trimmed = bookId.trim();
  if (!isValidGoodreadsBookId(trimmed)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Goodreads book ID must be a numeric Book Id (from CSV export)",
    );
  }

  const html = await fetchGoodreadsHtml(trimmed);
  const coverUrl = parseBookDataFromHtml(html, trimmed).coverImageUrl;

  if (!coverUrl) {
    throw new AppError(
      404,
      "COVER_NOT_FOUND",
      "No cover image found for this Goodreads book ID",
    );
  }

  return coverUrl;
}

export async function fetchBookDataByBookId(
  input: string,
): Promise<GoodreadsBookData> {
  const bookId = parseGoodreadsBookId(input);
  if (!bookId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Enter a numeric Goodreads Book Id or a goodreads.com/book/show/… URL",
    );
  }

  const html = await fetchGoodreadsHtml(bookId);
  const data = parseBookDataFromHtml(html, bookId);

  if (!data.title || data.title === "Unknown title") {
    throw new AppError(
      404,
      "BOOK_NOT_FOUND",
      "Could not parse book data from Goodreads for this ID",
    );
  }

  const existing = await prisma.book.findUnique({
    where: { externalId: bookId },
    select: { id: true, title: true, readingOnly: true },
  });

  return {
    ...data,
    existingBook: existing,
  };
}
