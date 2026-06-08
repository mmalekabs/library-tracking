import { apiFetch } from "./api";

export function fetchStatsOverview() {
  return apiFetch<OverviewStats>("/admin/stats/overview");
}

export function fetchStatsReading() {
  return apiFetch<ReadingStats>("/admin/stats/reading");
}

export function fetchStatsSpending() {
  return apiFetch<SpendingStats>("/admin/stats/spending");
}

export function fetchStatsAuthors() {
  return apiFetch<AuthorsStats>("/admin/stats/authors");
}

export function fetchStatsPublishers() {
  return apiFetch<PublishersStats>("/admin/stats/publishers");
}

export function fetchStatsFormats() {
  return apiFetch<FormatsStats>("/admin/stats/formats");
}

export function fetchStatsTimeline() {
  return apiFetch<TimelineStats>("/admin/stats/timeline");
}

export function fetchStatsBookshelves() {
  return apiFetch<BookshelfStat[]>("/admin/stats/bookshelves");
}

export function fetchStatsPages() {
  return apiFetch<PagesStats>("/admin/stats/pages");
}

export function fetchStatsLists() {
  return apiFetch<ListsStats>("/admin/stats/lists");
}

export interface OverviewStats {
  totalBooks: number;
  totalPages: number;
  totalSpent: number;
  totalValue: number;
  totalSavings: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  totalAuthors: number;
  totalPublishers: number;
  booksRead: number;
  publicBooks: number;
  hiddenBooks: number;
  booksAddedThisMonth: number;
  byStatus: Record<string, number>;
  byFormat: Record<string, number>;
  avgPagesPerBook: number | null;
  avgSpentPerBook: number | null;
  avgValuePerBook: number | null;
  booksWithMarketPrice: number;
}

export interface ReadingStats {
  breakdown: { status: string; count: number; percentage: number }[];
  total: number;
}

export interface SpendingStats {
  spendingByMonth: { month: string; amount: number }[];
  cumulativeSpending: { month: string; total: number }[];
  avgPriceByFormat: { format: string; average: number; total: number }[];
  topExpensive: { id: string; title: string; author: string; purchasePrice: number; currency: string }[];
  topCheapest: { id: string; title: string; author: string; purchasePrice: number; currency: string }[];
  mostExpensive: { title: string; purchasePrice: number } | null;
  cheapest: { title: string; purchasePrice: number } | null;
  medianPrice: number | null;
}

export interface AuthorsStats {
  table: { id: string; name: string; bookCount: number; totalPages: number; totalSpent: number; avgPrice: number | null }[];
  topByBookCount: { name: string; bookCount: number }[];
  topBySpending: { name: string; totalSpent: number }[];
}

export interface PublishersStats {
  table: { id: string; name: string; bookCount: number; totalSpent: number; avgPrice: number | null }[];
  topByBookCount: { name: string; bookCount: number }[];
}

export interface FormatsStats {
  distribution: { format: string; count: number; percentage: number }[];
  spendingByFormat: { format: string; totalSpent: number; average: number }[];
}

export interface TimelineStats {
  booksAddedPerMonth: { month: string; count: number }[];
  booksAddedByFormat: { month: string; PHYSICAL: number; DIGITAL: number; AUDIO: number }[];
  byPublicationDecade: { decade: string; count: number }[];
  oldestBook: { title: string; year: number } | null;
  newestBook: { title: string; year: number } | null;
}

export interface BookshelfStat {
  id: string;
  name: string;
  bookCount: number;
}

export interface PagesStats {
  histogram: { bucket: string; count: number }[];
  longestBook: { title: string; pages: number } | null;
  shortestBook: { title: string; pages: number } | null;
  averagePages: number | null;
  medianPages: number | null;
  scatter: { title: string; pages: number; price: number }[];
  bindingBreakdown: { binding: string; count: number; percentage: number }[];
}

export interface ListsStats {
  recentlyAdded: { id: string; title: string; dateAdded: string; author: { name: string } }[];
  currentlyReading: { id: string; title: string; dateStartedReading: string | null; author: { name: string } }[];
  withoutMarketPrice: { count: number; books: { id: string; title: string; author: { name: string } }[] };
  withoutPages: { count: number; books: { id: string; title: string; author: { name: string } }[] };
  withoutCover: { count: number; books: { id: string; title: string; author: { name: string } }[] };
  similarAuthors: { name1: string; name2: string }[];
}
