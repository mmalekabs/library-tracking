import { prisma } from "../lib/prisma.js";
import { decimalToNumber } from "../utils/book.js";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getOverview() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBooks,
    pageSum,
    authorCount,
    publisherCount,
    publicBooks,
    hiddenBooks,
    booksAddedThisMonth,
    readCount,
    statusGroups,
    formatGroups,
    books,
  ] = await Promise.all([
    prisma.book.count(),
    prisma.book.aggregate({ _sum: { numberOfPages: true } }),
    prisma.author.count(),
    prisma.publisher.count(),
    prisma.book.count({ where: { isPubliclyVisible: true } }),
    prisma.book.count({ where: { isPubliclyVisible: false } }),
    prisma.book.count({ where: { dateAdded: { gte: monthStart } } }),
    prisma.book.count({ where: { status: "READ" } }),
    prisma.book.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.book.groupBy({ by: ["format"], _count: { _all: true } }),
    prisma.book.findMany({
      select: {
        purchasePrice: true,
        marketPrice: true,
        numberOfPages: true,
      },
    }),
  ]);

  const prices = books
    .map((b) => decimalToNumber(b.purchasePrice))
    .filter((p): p is number => p !== null);

  const marketPrices = books
    .map((b) => decimalToNumber(b.marketPrice))
    .filter((p): p is number => p !== null);

  const totalSpent = prices.reduce((s, p) => s + p, 0);
  const totalValue = marketPrices.reduce((s, p) => s + p, 0);
  const averagePrice = prices.length ? totalSpent / prices.length : null;
  const medianPrice = median(prices);

  let totalSavings: number | null = null;
  const savingsValues = books
    .map((b) => {
      const purchase = decimalToNumber(b.purchasePrice);
      const market = decimalToNumber(b.marketPrice);
      if (purchase === null || market === null) return null;
      return market - purchase;
    })
    .filter((s): s is number => s !== null);
  if (savingsValues.length > 0) {
    totalSavings = savingsValues.reduce((s, v) => s + v, 0);
  }

  const totalPages = pageSum._sum.numberOfPages ?? 0;

  const byStatus: Record<string, number> = {
    TO_READ: 0,
    READING: 0,
    READ: 0,
    DID_NOT_FINISH: 0,
    ON_HOLD: 0,
  };
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }

  const byFormat: Record<string, number> = {
    PHYSICAL: 0,
    DIGITAL: 0,
    AUDIO: 0,
  };
  for (const g of formatGroups) {
    byFormat[g.format] = g._count._all;
  }

  return {
    totalBooks,
    totalPages,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    totalSavings: totalSavings !== null ? Math.round(totalSavings * 100) / 100 : null,
    averagePrice: averagePrice !== null ? Math.round(averagePrice * 100) / 100 : null,
    medianPrice: medianPrice !== null ? Math.round(medianPrice * 100) / 100 : null,
    totalAuthors: authorCount,
    totalPublishers: publisherCount,
    booksRead: readCount,
    publicBooks,
    hiddenBooks,
    booksAddedThisMonth,
    byStatus,
    byFormat,
    avgPagesPerBook:
      totalBooks > 0 ? Math.round(totalPages / totalBooks) : null,
    avgSpentPerBook:
      prices.length > 0 ? Math.round((totalSpent / prices.length) * 100) / 100 : null,
    avgValuePerBook:
      marketPrices.length > 0
        ? Math.round((totalValue / marketPrices.length) * 100) / 100
        : null,
    booksWithMarketPrice: marketPrices.length,
  };
}

export async function getReading() {
  const overview = await getOverview();
  const total = overview.totalBooks || 1;
  const breakdown = Object.entries(overview.byStatus).map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / total) * 1000) / 10,
  }));
  return { breakdown, total: overview.totalBooks };
}

export async function getSpending() {
  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      purchasePrice: true,
      marketPrice: true,
      currency: true,
      format: true,
      dateAdded: true,
      author: { select: { name: true } },
    },
    orderBy: { purchasePrice: "desc" },
  });

  const monthlyMap = new Map<string, number>();
  const cumulative: { month: string; total: number }[] = [];
  let running = 0;

  const sortedMonths = new Set<string>();
  for (const book of books) {
    const price = decimalToNumber(book.purchasePrice);
    if (price === null) continue;
    const key = monthKey(book.dateAdded);
    sortedMonths.add(key);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + price);
  }

  const months = [...sortedMonths].sort();
  for (const month of months) {
    running += monthlyMap.get(month) ?? 0;
    cumulative.push({
      month,
      total: Math.round(running * 100) / 100,
    });
  }

  const spendingByMonth = months.map((month) => ({
    month,
    amount: Math.round((monthlyMap.get(month) ?? 0) * 100) / 100,
  }));

  const formatTotals = new Map<string, { sum: number; count: number }>();
  for (const book of books) {
    const price = decimalToNumber(book.purchasePrice);
    if (price === null) continue;
    const entry = formatTotals.get(book.format) ?? { sum: 0, count: 0 };
    entry.sum += price;
    entry.count += 1;
    formatTotals.set(book.format, entry);
  }

  const avgPriceByFormat = [...formatTotals.entries()].map(([format, { sum, count }]) => ({
    format,
    average: Math.round((sum / count) * 100) / 100,
    total: Math.round(sum * 100) / 100,
  }));

  const withPrice = books
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author?.name ?? "—",
      purchasePrice: decimalToNumber(b.purchasePrice),
      currency: b.currency,
    }))
    .filter((b) => b.purchasePrice !== null) as {
    id: string;
    title: string;
    author: string;
    purchasePrice: number;
    currency: string;
  }[];

  const mostExpensive = withPrice[0] ?? null;
  const cheapest = withPrice.length ? withPrice[withPrice.length - 1] : null;

  return {
    spendingByMonth,
    cumulativeSpending: cumulative,
    avgPriceByFormat,
    topExpensive: withPrice.slice(0, 10),
    topCheapest: [...withPrice].reverse().slice(0, 10),
    mostExpensive,
    cheapest,
    medianPrice: median(withPrice.map((b) => b.purchasePrice)),
  };
}

export async function getAuthors() {
  const authors = await prisma.author.findMany({
    select: {
      id: true,
      name: true,
      booksAsPrimary: {
        select: {
          purchasePrice: true,
          numberOfPages: true,
        },
      },
    },
  });

  const rows = authors
    .map((a) => {
      const bookCount = a.booksAsPrimary.length;
      const prices = a.booksAsPrimary
        .map((b) => decimalToNumber(b.purchasePrice))
        .filter((p): p is number => p !== null);
      const pages = a.booksAsPrimary.reduce(
        (s, b) => s + (b.numberOfPages ?? 0),
        0,
      );
      const totalSpent = prices.reduce((s, p) => s + p, 0);
      return {
        id: a.id,
        name: a.name,
        bookCount,
        totalPages: pages,
        totalSpent: Math.round(totalSpent * 100) / 100,
        avgPrice:
          prices.length > 0
            ? Math.round((totalSpent / prices.length) * 100) / 100
            : null,
      };
    })
    .filter((a) => a.bookCount > 0);

  return {
    table: rows.sort((a, b) => b.bookCount - a.bookCount),
    topByBookCount: [...rows]
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 15),
    topBySpending: [...rows]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10),
  };
}

export async function getPublishers() {
  const publishers = await prisma.publisher.findMany({
    select: {
      id: true,
      name: true,
      books: { select: { purchasePrice: true } },
    },
  });

  const rows = publishers
    .map((p) => {
      const bookCount = p.books.length;
      const prices = p.books
        .map((b) => decimalToNumber(b.purchasePrice))
        .filter((pr): pr is number => pr !== null);
      const totalSpent = prices.reduce((s, pr) => s + pr, 0);
      return {
        id: p.id,
        name: p.name,
        bookCount,
        totalSpent: Math.round(totalSpent * 100) / 100,
        avgPrice:
          prices.length > 0
            ? Math.round((totalSpent / prices.length) * 100) / 100
            : null,
      };
    })
    .filter((p) => p.bookCount > 0);

  return {
    table: rows.sort((a, b) => b.bookCount - a.bookCount),
    topByBookCount: [...rows]
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 15),
  };
}

export async function getFormats() {
  const books = await prisma.book.findMany({
    select: { format: true, purchasePrice: true },
  });

  const counts: Record<string, number> = { PHYSICAL: 0, DIGITAL: 0, AUDIO: 0 };
  const spending: Record<string, number> = { PHYSICAL: 0, DIGITAL: 0, AUDIO: 0 };
  const spendCount: Record<string, number> = { PHYSICAL: 0, DIGITAL: 0, AUDIO: 0 };

  for (const b of books) {
    counts[b.format] = (counts[b.format] ?? 0) + 1;
    const price = decimalToNumber(b.purchasePrice);
    if (price !== null) {
      spending[b.format] = (spending[b.format] ?? 0) + price;
      spendCount[b.format] = (spendCount[b.format] ?? 0) + 1;
    }
  }

  const total = books.length || 1;
  const distribution = Object.entries(counts).map(([format, count]) => ({
    format,
    count,
    percentage: Math.round((count / total) * 1000) / 10,
  }));

  const spendingByFormat = Object.entries(spending).map(([format, totalSpent]) => ({
    format,
    totalSpent: Math.round(totalSpent * 100) / 100,
    average:
      spendCount[format] > 0
        ? Math.round((totalSpent / spendCount[format]) * 100) / 100
        : 0,
  }));

  return { distribution, spendingByFormat };
}

export async function getTimeline() {
  const books = await prisma.book.findMany({
    select: {
      dateAdded: true,
      format: true,
      originalPublicationYear: true,
      yearPublished: true,
      title: true,
    },
  });

  const monthlyTotal = new Map<string, number>();
  const monthlyByFormat = new Map<string, Record<string, number>>();

  for (const book of books) {
    const key = monthKey(book.dateAdded);
    monthlyTotal.set(key, (monthlyTotal.get(key) ?? 0) + 1);
    const fmtMap = monthlyByFormat.get(key) ?? {
      PHYSICAL: 0,
      DIGITAL: 0,
      AUDIO: 0,
    };
    fmtMap[book.format] = (fmtMap[book.format] ?? 0) + 1;
    monthlyByFormat.set(key, fmtMap);
  }

  const months = [...monthlyTotal.keys()].sort();
  const booksAddedPerMonth = months.map((month) => ({
    month,
    count: monthlyTotal.get(month) ?? 0,
  }));

  const booksAddedByFormat = months.map((month) => ({
    month,
    ...(monthlyByFormat.get(month) ?? { PHYSICAL: 0, DIGITAL: 0, AUDIO: 0 }),
  }));

  const decadeBuckets: Record<string, number> = {
    "1800s": 0,
    "1900-1950": 0,
    "1950-1970": 0,
    "1970-1990": 0,
    "1990-2000": 0,
    "2000-2010": 0,
    "2010-2020": 0,
    "2020+": 0,
    Unknown: 0,
  };

  const bucketForYear = (year: number | null): string => {
    if (year === null) return "Unknown";
    if (year < 1900) return "1800s";
    if (year < 1950) return "1900-1950";
    if (year < 1970) return "1950-1970";
    if (year < 1990) return "1970-1990";
    if (year < 2000) return "1990-2000";
    if (year < 2010) return "2000-2010";
    if (year < 2020) return "2010-2020";
    return "2020+";
  };

  let oldest: { title: string; year: number } | null = null;
  let newest: { title: string; year: number } | null = null;

  for (const book of books) {
    const year = book.originalPublicationYear ?? book.yearPublished;
    const bucket = bucketForYear(year);
    decadeBuckets[bucket] = (decadeBuckets[bucket] ?? 0) + 1;
    if (year !== null) {
      if (!oldest || year < oldest.year) {
        oldest = { title: book.title, year };
      }
      if (!newest || year > newest.year) {
        newest = { title: book.title, year };
      }
    }
  }

  const byPublicationDecade = Object.entries(decadeBuckets).map(
    ([decade, count]) => ({ decade, count }),
  );

  return {
    booksAddedPerMonth,
    booksAddedByFormat,
    byPublicationDecade,
    oldestBook: oldest,
    newestBook: newest,
  };
}

export async function getBookshelves() {
  const shelves = await prisma.bookshelf.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { books: true } },
    },
    orderBy: { books: { _count: "desc" } },
  });

  return shelves.map((s) => ({
    id: s.id,
    name: s.name,
    bookCount: s._count.books,
  }));
}

export async function getPagesAndBinding() {
  const books = await prisma.book.findMany({
    select: {
      title: true,
      numberOfPages: true,
      purchasePrice: true,
      binding: true,
    },
  });

  const histogram = [
    { bucket: "0-100", count: 0 },
    { bucket: "100-200", count: 0 },
    { bucket: "200-300", count: 0 },
    { bucket: "300-400", count: 0 },
    { bucket: "400-500", count: 0 },
    { bucket: "500-1000", count: 0 },
    { bucket: "1000+", count: 0 },
  ];

  const pageCounts: number[] = [];
  const scatter: { title: string; pages: number; price: number }[] = [];
  let longest: { title: string; pages: number } | null = null;
  let shortest: { title: string; pages: number } | null = null;
  const bindingCounts: Record<string, number> = {};

  const pageBucket = (pages: number): string => {
    if (pages <= 100) return "0-100";
    if (pages <= 200) return "100-200";
    if (pages <= 300) return "200-300";
    if (pages <= 400) return "300-400";
    if (pages <= 500) return "400-500";
    if (pages <= 1000) return "500-1000";
    return "1000+";
  };

  for (const book of books) {
    bindingCounts[book.binding] = (bindingCounts[book.binding] ?? 0) + 1;

    if (book.numberOfPages !== null) {
      const pages = book.numberOfPages;
      pageCounts.push(pages);
      histogram.find((x) => x.bucket === pageBucket(pages))!.count += 1;

      if (!longest || pages > longest.pages) longest = { title: book.title, pages };
      if (!shortest || pages < shortest.pages) shortest = { title: book.title, pages };

      const price = decimalToNumber(book.purchasePrice);
      if (price !== null) {
        scatter.push({ title: book.title, pages, price });
      }
    }
  }

  const total = books.length || 1;
  const bindingBreakdown = Object.entries(bindingCounts).map(([binding, count]) => ({
    binding,
    count,
    percentage: Math.round((count / total) * 1000) / 10,
  }));

  return {
    histogram,
    longestBook: longest,
    shortestBook: shortest,
    averagePages:
      pageCounts.length > 0
        ? Math.round(pageCounts.reduce((s, p) => s + p, 0) / pageCounts.length)
        : null,
    medianPages: median(pageCounts),
    scatter: scatter.slice(0, 200),
    bindingBreakdown,
  };
}

export async function getLists() {
  const [
    recent,
    currentlyReading,
    noMarketPrice,
    noPages,
    noCover,
    authors,
  ] = await Promise.all([
    prisma.book.findMany({
      take: 10,
      orderBy: { dateAdded: "desc" },
      select: {
        id: true,
        title: true,
        dateAdded: true,
        author: { select: { name: true } },
      },
    }),
    prisma.book.findMany({
      where: { status: "READING" },
      select: {
        id: true,
        title: true,
        dateStartedReading: true,
        author: { select: { name: true } },
      },
    }),
    prisma.book.findMany({
      where: { marketPrice: null },
      take: 20,
      select: { id: true, title: true, author: { select: { name: true } } },
    }),
    prisma.book.findMany({
      where: { numberOfPages: null },
      take: 20,
      select: { id: true, title: true, author: { select: { name: true } } },
    }),
    prisma.book.findMany({
      where: { OR: [{ coverImageUrl: null }, { coverImageUrl: "" }] },
      take: 20,
      select: { id: true, title: true, author: { select: { name: true } } },
    }),
    prisma.author.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const noMarketPriceCount = await prisma.book.count({
    where: { marketPrice: null },
  });
  const noPagesCount = await prisma.book.count({ where: { numberOfPages: null } });
  const noCoverCount = await prisma.book.count({
    where: { OR: [{ coverImageUrl: null }, { coverImageUrl: "" }] },
  });

  // Similar author names (simple: normalize and find duplicates)
  const similarAuthors: { name1: string; name2: string }[] = [];
  for (let i = 0; i < authors.length; i++) {
    for (let j = i + 1; j < authors.length; j++) {
      const a = authors[i].name.toLowerCase().trim();
      const b = authors[j].name.toLowerCase().trim();
      if (a === b) continue;
      if (a.includes(b) || b.includes(a) || levenshteinClose(a, b)) {
        similarAuthors.push({
          name1: authors[i].name,
          name2: authors[j].name,
        });
      }
      if (similarAuthors.length >= 15) break;
    }
    if (similarAuthors.length >= 15) break;
  }

  return {
    recentlyAdded: recent.map((b) => ({
      ...b,
      dateAdded: b.dateAdded.toISOString(),
    })),
    currentlyReading: currentlyReading.map((b) => ({
      ...b,
      dateStartedReading: b.dateStartedReading?.toISOString() ?? null,
    })),
    withoutMarketPrice: { count: noMarketPriceCount, books: noMarketPrice },
    withoutPages: { count: noPagesCount, books: noPages },
    withoutCover: { count: noCoverCount, books: noCover },
    similarAuthors: similarAuthors.slice(0, 10),
  };
}

function levenshteinClose(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 3) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4) return false;
  let dist = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) dist++;
  }
  dist += Math.abs(a.length - b.length);
  return dist <= 2;
}
