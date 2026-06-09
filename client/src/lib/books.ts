import { apiFetch } from "./api";
import { AUTH_TOKEN_KEY } from "./constants";
import type { Book, BookFormat, BindingType, ReadingStatus } from "@/types";

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export type BookSortBy =
  | "title"
  | "author"
  | "publisher"
  | "status"
  | "format"
  | "binding"
  | "purchasePrice"
  | "marketPrice"
  | "currency"
  | "numberOfPages"
  | "yearPublished"
  | "isbn"
  | "isPubliclyVisible"
  | "isGift"
  | "dateAdded";

export interface BookListParams {
  page?: number;
  limit?: number;
  search?: string;
  format?: BookFormat;
  status?: ReadingStatus;
  binding?: BindingType;
  authorId?: string;
  publisherId?: string;
  bookshelfId?: string;
  sortBy?: BookSortBy;
  sortOrder?: "asc" | "desc";
  visibility?: "all" | "public" | "hidden";
  collection?: "library" | "to_purchase";
}

function toQueryString(params: BookListParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface PaginatedBooks {
  data: Book[];
  pagination: PaginationMeta;
}

async function fetchBookList(
  path: string,
  params: BookListParams = {},
): Promise<PaginatedBooks> {
  const API_BASE =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}${toQueryString(params)}`, {
    headers,
  });
  const json = await response.json();

  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? "Failed to fetch books");
  }

  return { data: json.data, pagination: json.pagination };
}

export function fetchPublicBooks(params?: BookListParams) {
  return fetchBookList("/books", params);
}

/** Public wishlist — to-purchase books marked publicly visible */
export function fetchPublicToPurchase(params?: BookListParams) {
  return fetchBookList("/to-purchase", params);
}

export function fetchPublicToPurchaseBook(id: string) {
  return apiFetch<Book>(`/to-purchase/${id}`);
}

export function fetchAdminBooks(params?: BookListParams) {
  return fetchBookList("/admin/books", {
    collection: "library",
    ...params,
  });
}

export function fetchToPurchaseBooks(params?: Omit<BookListParams, "collection">) {
  return fetchBookList("/admin/books", {
    collection: "to_purchase",
    ...params,
  });
}

export interface MoveToLibraryInput {
  numberOfPages: number;
  authorId?: string;
  authorName?: string;
  publisherId?: string;
  publisherName?: string;
  marketPrice: number;
  purchasePrice?: number | null;
}

/** Mark a wishlist book as owned with required library metadata */
export function moveBookToLibrary(id: string, data: MoveToLibraryInput) {
  return apiFetch<Book>(`/admin/books/${id}/move-to-library`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPublicBook(id: string) {
  return apiFetch<Book>(`/books/${id}`);
}

export function fetchAdminBook(id: string) {
  return apiFetch<Book>(`/admin/books/${id}`);
}

export function createBook(data: Record<string, unknown>) {
  return apiFetch<Book>("/admin/books", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBook(id: string, data: Record<string, unknown>) {
  return apiFetch<Book>(`/admin/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteBook(id: string) {
  return apiFetch<{ message: string }>(`/admin/books/${id}`, {
    method: "DELETE",
  });
}

export function toggleBookVisibility(id: string, isPubliclyVisible: boolean) {
  return apiFetch<Book>(`/admin/books/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ isPubliclyVisible }),
  });
}

export type MissingCoversCollection = "all" | "library" | "to_purchase";

export interface MissingCoversSummary {
  totalMissing: number;
  withGoodreadsId: number;
  withoutGoodreadsId: number;
}

export interface MissingCoversParams {
  page?: number;
  limit?: number;
  search?: string;
  collection?: MissingCoversCollection;
  withGoodreadsIdOnly?: boolean;
}

export interface BulkFetchCoversReport {
  attempted: number;
  updated: number;
  skipped: number;
  failed: { id: string; title: string; message: string }[];
}

export function fetchMissingCoversSummary(collection: MissingCoversCollection = "all") {
  return apiFetch<MissingCoversSummary>(
    `/admin/books/missing-covers/summary?collection=${collection}`,
  );
}

export function fetchBooksMissingCovers(params: MissingCoversParams = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return fetchBookList(
    `/admin/books/missing-covers${qs ? `?${qs}` : ""}`,
  );
}

export function bulkFetchGoodreadsCovers(body: {
  bookIds?: string[];
  collection?: MissingCoversCollection;
  onlyWithGoodreadsId?: boolean;
}) {
  return apiFetch<BulkFetchCoversReport>("/admin/books/bulk-fetch-covers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Numeric Goodreads Book Id (CSV "Book Id") */
export function hasGoodreadsBookId(externalId: string | null | undefined): boolean {
  return !!externalId?.trim() && /^\d+$/.test(externalId.trim());
}
