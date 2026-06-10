import { apiFetch } from "./api";
import { AUTH_TOKEN_KEY } from "./constants";
import type { PaginationMeta } from "./books";
import type { BindingType, BookFormat, ReadingStatus } from "@/types";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";

export interface ReadingEntryBook {
  id: string;
  title: string;
  numberOfPages: number | null;
  coverImageUrl: string | null;
  format: string;
  readingOnly: boolean;
  author: { id: string; name: string } | null;
}

export interface ReadableBook {
  id: string;
  title: string;
  numberOfPages: number | null;
  coverImageUrl: string | null;
  format: string;
  readingOnly: boolean;
  author: { id: string; name: string } | null;
}

export interface ReadingSessionSummary {
  id: string;
  sessionDate: string;
  pagesRead: number;
  minutesRead: number | null;
  endPage: number | null;
  note: string | null;
  createdAt?: string;
}

export interface ReadingEntryDetail extends ReadingEntry {
  sessions: ReadingSessionSummary[];
}

export interface ReadingEntry {
  id: string;
  bookId: string;
  status: ReadingStatus;
  startedAt: string;
  finishedAt: string | null;
  currentPage: number | null;
  rating: number | null;
  review: string | null;
  book: ReadingEntryBook;
  recentSessions: ReadingSessionSummary[];
  totalPagesRead: number;
  totalMinutes: number;
  sessionCount: number;
  progressPage: number;
  progressPercent: number | null;
  calendarDays: number | null;
}

export interface ReadingSummary {
  currentlyReading: number;
  historyCount: number;
  totalSessions: number;
  totalPagesLogged: number;
  totalMinutesLogged: number;
  booksFinishedThisYear: number;
  today: { pagesRead: number; minutesRead: number; date: string };
  thisWeek: { pagesRead: number; minutesRead: number };
  thisMonth: { pagesRead: number; minutesRead: number };
}

export interface ReadingStatsTimeline {
  period: string;
  pagesRead: number;
  minutesRead: number;
  sessions: number;
}

export interface ReadingStats {
  period: "day" | "week" | "month" | "year";
  from: string;
  to: string;
  totals: {
    pagesRead: number;
    minutesRead: number;
    sessions: number;
    booksFinished: number;
  };
  timeline: ReadingStatsTimeline[];
}

export interface BookTimeStat {
  bookId: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  numberOfPages: number | null;
  readCount: number;
  totalPagesRead: number;
  totalMinutes: number;
  totalCalendarDays: number;
  entries: {
    id: string;
    status: ReadingStatus;
    startedAt: string;
    finishedAt: string | null;
    rating: number | null;
    pagesRead: number;
    minutes: number;
    calendarDays: number | null;
  }[];
}

export function fetchReadingSummary() {
  return apiFetch<ReadingSummary>("/admin/reading/summary");
}

export function fetchCurrentlyReading() {
  return apiFetch<ReadingEntry[]>("/admin/reading/current");
}

export async function fetchReadingHistory(params: {
  page?: number;
  limit?: number;
  status?: "READ" | "DID_NOT_FINISH" | "all";
}): Promise<{ data: ReadingEntry[]; pagination: PaginationMeta }> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(
    `${API_BASE}/admin/reading/history${qs ? `?${qs}` : ""}`,
    { headers },
  );
  const json = await response.json();
  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? "Failed to fetch history");
  }
  return { data: json.data, pagination: json.pagination };
}

export function fetchReadingStats(params: {
  period?: "day" | "week" | "month" | "year";
  from?: string;
  to?: string;
}) {
  const q = new URLSearchParams();
  if (params.period) q.set("period", params.period);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return apiFetch<ReadingStats>(`/admin/reading/stats${qs ? `?${qs}` : ""}`);
}

export function fetchBookTimeStats() {
  return apiFetch<BookTimeStat[]>("/admin/reading/stats/books");
}

export function fetchReadableBooks(params?: { search?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<ReadableBook[]>(
    `/admin/reading/books${qs ? `?${qs}` : ""}`,
  );
}

export interface ReadingOnlyBookDetail {
  id: string;
  externalId: string | null;
  title: string;
  isbn: string | null;
  isbn13: string | null;
  format: BookFormat;
  binding: BindingType;
  numberOfPages: number | null;
  yearPublished: number | null;
  originalPublicationYear: number | null;
  edition: string | null;
  coverImageUrl: string | null;
  notes: string | null;
  readingOnly: boolean;
  author: { id: string; name: string } | null;
  additionalAuthors: { id: string; name: string }[];
  publisher: { id: string; name: string } | null;
}

export interface CreateReadingOnlyBookInput {
  title: string;
  externalId?: string | null;
  authorName?: string | null;
  additionalAuthorNames?: string[];
  publisherName?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
  edition?: string | null;
  format?: BookFormat;
  binding?: BindingType;
  numberOfPages?: number | null;
  yearPublished?: number | null;
  originalPublicationYear?: number | null;
  coverImageUrl?: string | null;
  notes?: string | null;
  entry?: {
    status?: "READING" | "READ" | "DID_NOT_FINISH" | "ON_HOLD";
    startedAt?: string | null;
    finishedAt?: string | null;
    currentPage?: number | null;
    rating?: number | null;
    review?: string | null;
  };
}

export type UpdateReadingOnlyBookInput = Partial<
  Omit<CreateReadingOnlyBookInput, "entry">
>;

export function fetchReadingOnlyBook(id: string) {
  return apiFetch<ReadingOnlyBookDetail>(`/admin/reading/books/${id}`);
}

export function createReadingOnlyBook(input: CreateReadingOnlyBookInput) {
  return apiFetch<{ book: ReadableBook; entry: ReadingEntry | null }>(
    "/admin/reading/books",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateReadingOnlyBook(
  id: string,
  input: UpdateReadingOnlyBookInput,
) {
  return apiFetch<ReadingOnlyBookDetail>(`/admin/reading/books/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function startReading(
  bookId: string,
  options?: {
    startedAt?: string;
    status?: "READING" | "ON_HOLD";
  },
) {
  return apiFetch<ReadingEntry>("/admin/reading/entries", {
    method: "POST",
    body: JSON.stringify({
      bookId,
      startedAt: options?.startedAt,
      status: options?.status,
    }),
  });
}

export function updateReadingEntry(
  id: string,
  data: {
    status?: "READING" | "READ" | "DID_NOT_FINISH" | "ON_HOLD";
    currentPage?: number | null;
    rating?: number | null;
    review?: string | null;
    finishedAt?: string | null;
  },
) {
  return apiFetch<ReadingEntry>(`/admin/reading/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchReadingEntry(id: string) {
  return apiFetch<ReadingEntryDetail>(`/admin/reading/entries/${id}`);
}

export function logReadingSession(
  entryId: string,
  data: {
    sessionDate: string;
    endPage?: number;
    pagesRead?: number;
    minutesRead?: number | null;
    note?: string | null;
  },
) {
  return apiFetch<ReadingSessionSummary>(
    `/admin/reading/entries/${entryId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function updateReadingSession(
  sessionId: string,
  data: {
    sessionDate?: string;
    pagesRead?: number;
    minutesRead?: number | null;
    endPage?: number | null;
    note?: string | null;
  },
) {
  return apiFetch<ReadingSessionSummary>(`/admin/reading/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteReadingSession(sessionId: string) {
  return apiFetch<{ deleted: boolean; entryId: string }>(
    `/admin/reading/sessions/${sessionId}`,
    { method: "DELETE" },
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
