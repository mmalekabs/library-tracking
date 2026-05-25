import { AppError } from "../middleware/errorHandler.js";

const GOODREADS_BOOK_URL = "https://www.goodreads.com/book/show";
const FETCH_TIMEOUT_MS = 15_000;

export function isValidGoodreadsBookId(
  externalId: string | null | undefined,
): boolean {
  return !!externalId?.trim() && /^\d+$/.test(externalId.trim());
}

export function goodreadsBookUrl(bookId: string): string {
  return `${GOODREADS_BOOK_URL}/${bookId.trim()}`;
}

const OG_IMAGE_PATTERNS = [
  /property="og:image"\s+content="([^"]+)"/i,
  /property='og:image'\s+content='([^']+)'/i,
  /name="twitter:image"\s+content="([^"]+)"/i,
];

function decodeHtmlEntities(url: string): string {
  return url.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

function isPlaceholderCover(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("no-cover") || lower.includes("/default/");
}

export async function fetchCoverUrlByBookId(bookId: string): Promise<string> {
  const trimmed = bookId.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Goodreads book ID must be a numeric Book Id (from CSV export)",
    );
  }

  const pageUrl = goodreadsBookUrl(trimmed);
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PersonalLibraryTracker/1.0; +cover-lookup)",
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

  const html = await response.text();
  let coverUrl: string | null = null;

  for (const pattern of OG_IMAGE_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      coverUrl = decodeHtmlEntities(match[1].trim());
      break;
    }
  }

  if (!coverUrl || isPlaceholderCover(coverUrl)) {
    throw new AppError(
      404,
      "COVER_NOT_FOUND",
      "No cover image found for this Goodreads book ID",
    );
  }

  return coverUrl;
}
