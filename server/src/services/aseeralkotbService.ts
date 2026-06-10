import { AppError } from "../middleware/errorHandler.js";

const BASE_URL = "https://www.aseeralkotb.com";
const FETCH_TIMEOUT_MS = 20_000;
const MARKET_PRICE_DISCOUNT = 0.9;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface AseerAlkotbPriceResult {
  isbn13: string;
  listPrice: number;
  marketPrice: number;
  currency: string;
  bookId: string;
  bookUrl: string;
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'");
}

function normalizeIsbn13(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (cleaned.length !== 13) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "ISBN-13 must be exactly 13 digits",
    );
  }
  return cleaned;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function createSession(): Promise<{ cookie: string }> {
  const first = await fetchWithTimeout(`${BASE_URL}/`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!first.ok) {
    throw new AppError(
      502,
      "ASEERALKOTB_UNAVAILABLE",
      `Could not reach عصير الكتب (HTTP ${first.status})`,
    );
  }

  const html = await first.text();
  const cookie = html.match(/AserElKotb=[^;\\]+/)?.[0];
  if (!cookie) {
    throw new AppError(
      502,
      "ASEERALKOTB_UNAVAILABLE",
      "Could not establish a session with عصير الكتب",
    );
  }

  await fetchWithTimeout(`${BASE_URL}/ar`, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });

  return { cookie };
}

function bookKeysFromSearchHtml(html: string): string[] {
  const decoded = decodeHtmlEntities(html);
  return [
    ...new Set(
      [...decoded.matchAll(/"key":"(\d+)","s":"mdl"/g)].map((match) => match[1]),
    ),
  ];
}

function parseBookPage(html: string): {
  isbn13: string | null;
  listPrice: number | null;
  currency: string | null;
} {
  if (html.length < 5000) {
    return { isbn13: null, listPrice: null, currency: null };
  }

  const isbn13 = html.match(/"isbn"\s*:\s*"(978\d{10})"/)?.[1] ?? null;
  const priceRaw =
    html.match(/itemprop="price"\s+content="([\d.]+)"/)?.[1] ??
    html.match(/"price"\s*:\s*"([\d.]+)"/)?.[1];
  const currency =
    html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)?.[1] ??
    html.match(/itemprop="priceCurrency"\s+content="([A-Z]{3})"/)?.[1] ??
    "SAR";

  const listPrice = priceRaw ? Number.parseFloat(priceRaw) : null;
  return {
    isbn13,
    listPrice: listPrice != null && Number.isFinite(listPrice) ? listPrice : null,
    currency,
  };
}

async function fetchBookPage(
  cookie: string,
  bookKey: string,
): Promise<string> {
  const response = await fetchWithTimeout(`${BASE_URL}/ar/books/${bookKey}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: cookie,
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new AppError(
      502,
      "ASEERALKOTB_UNAVAILABLE",
      `Could not load book page (HTTP ${response.status})`,
    );
  }

  return response.text();
}

async function searchBookKeys(
  cookie: string,
  query: string,
): Promise<string[]> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/ar/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookie,
        Accept: "text/html",
      },
    },
  );

  if (!response.ok) {
    throw new AppError(
      502,
      "ASEERALKOTB_UNAVAILABLE",
      `Search failed on عصير الكتب (HTTP ${response.status})`,
    );
  }

  return bookKeysFromSearchHtml(await response.text());
}

async function findBookByIsbn(
  cookie: string,
  isbn13: string,
  titleFallback?: string | null,
): Promise<AseerAlkotbPriceResult | null> {
  const queries = [isbn13];
  const trimmedTitle = titleFallback?.trim();
  if (trimmedTitle && !queries.includes(trimmedTitle)) {
    queries.push(trimmedTitle);
  }

  const triedKeys = new Set<string>();

  for (const query of queries) {
    const keys = await searchBookKeys(cookie, query);
    for (const key of keys) {
      if (triedKeys.has(key)) continue;
      triedKeys.add(key);

      const html = await fetchBookPage(cookie, key);
      const parsed = parseBookPage(html);
      if (parsed.isbn13 !== isbn13 || parsed.listPrice == null) continue;

      const marketPrice =
        Math.round(parsed.listPrice * MARKET_PRICE_DISCOUNT * 100) / 100;

      return {
        isbn13,
        listPrice: parsed.listPrice,
        marketPrice,
        currency: parsed.currency ?? "SAR",
        bookId: key,
        bookUrl: `${BASE_URL}/ar/books/${key}`,
      };
    }
  }

  return null;
}

export async function lookupMarketPriceByIsbn13(
  isbnInput: string,
  options: { titleFallback?: string | null } = {},
): Promise<AseerAlkotbPriceResult> {
  const isbn13 = normalizeIsbn13(isbnInput);
  const { cookie } = await createSession();
  const result = await findBookByIsbn(cookie, isbn13, options.titleFallback);

  if (!result) {
    throw new AppError(
      404,
      "ASEERALKOTB_NOT_FOUND",
      "No matching book or price found on عصير الكتب for this ISBN-13",
    );
  }

  return result;
}
