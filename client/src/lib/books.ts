import { apiFetch, ApiError } from "./api";
import { AUTH_TOKEN_KEY } from "./constants";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";
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
  | "externalId"
  | "isPubliclyVisible"
  | "isGift"
  | "dateAdded"
  | "createdAt";

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
  collection?: "library" | "to_purchase" | "reading_only" | "all";
  createdFrom?: string;
  createdTo?: string;
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

export function bulkDeleteBooks(ids: string[]) {
  return apiFetch<{ deleted: number }>("/admin/books/bulk-delete", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export function toggleBookVisibility(id: string, isPubliclyVisible: boolean) {
  return apiFetch<Book>(`/admin/books/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ isPubliclyVisible }),
  });
}

export type MissingInfoCollection = "all" | "library" | "to_purchase";

export interface MissingInfoSummary {
  totalMissing: number;
  missingCover: number;
  missingIsbn13: number;
  missingMarketPrice: number;
  withGoodreadsId: number;
  withoutGoodreadsId: number;
  canFetchFromGoodreads: number;
  canFetchPrice: number;
}

export interface MissingInfoParams {
  page?: number;
  limit?: number;
  search?: string;
  collection?: MissingInfoCollection;
  withGoodreadsIdOnly?: boolean;
}

export interface BulkFetchReport {
  attempted: number;
  updated: number;
  skipped: number;
  failed: { id: string; title: string; message: string }[];
}

export function fetchMissingInfoSummary(collection: MissingInfoCollection = "all") {
  return apiFetch<MissingInfoSummary>(
    `/admin/books/missing-info/summary?collection=${collection}`,
  );
}

export function fetchBooksMissingInfo(params: MissingInfoParams = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return fetchBookList(`/admin/books/missing-info${qs ? `?${qs}` : ""}`);
}

export interface BulkFetchProgress {
  current: number;
  total: number;
  updated: number;
  failed: number;
  currentTitle: string | null;
}

type BulkStreamEvent =
  | ({ type: "progress" } & BulkFetchProgress)
  | { type: "done"; data: BulkFetchReport }
  | { type: "error"; message: string };

async function streamBulkFetch(
  path: string,
  body: Record<string, unknown>,
  onProgress?: (progress: BulkFetchProgress) => void,
): Promise<BulkFetchReport> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    let responseOffset = 0;
    let lineBuffer = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const handleEvent = (event: BulkStreamEvent) => {
      if (event.type === "progress") {
        onProgress?.({
          current: event.current,
          total: event.total,
          updated: event.updated,
          failed: event.failed,
          currentTitle: event.currentTitle,
        });
        return;
      }
      if (event.type === "done") {
        finish(() => resolve(event.data));
        return;
      }
      if (event.type === "error") {
        finish(() => reject(new ApiError("BULK_FETCH_FAILED", event.message, 500)));
      }
    };

    const processStreamChunk = () => {
      const chunk = xhr.responseText.slice(responseOffset);
      if (!chunk) return;
      responseOffset = xhr.responseText.length;
      lineBuffer += chunk;

      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          handleEvent(JSON.parse(trimmed) as BulkStreamEvent);
        } catch {
          finish(() => reject(new ApiError("INVALID_RESPONSE", "Bulk fetch failed", 500)));
          return;
        }
        if (settled) return;
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) {
        processStreamChunk();
      }
    };

    xhr.addEventListener("load", () => {
      processStreamChunk();
      if (lineBuffer.trim()) {
        try {
          handleEvent(JSON.parse(lineBuffer.trim()) as BulkStreamEvent);
        } catch {
          if (!settled) {
            finish(() =>
              reject(new ApiError("INVALID_RESPONSE", "Bulk fetch failed", 500)),
            );
          }
        }
      }
      if (!settled) {
        if (xhr.status < 200 || xhr.status >= 300) {
          finish(() =>
            reject(new ApiError("BULK_FETCH_FAILED", "Bulk fetch failed", xhr.status)),
          );
        } else {
          finish(() =>
            reject(new ApiError("INVALID_RESPONSE", "Bulk fetch ended without a result", 500)),
          );
        }
      }
    });

    xhr.addEventListener("error", () => {
      finish(() => reject(new ApiError("NETWORK_ERROR", "Bulk fetch failed", 0)));
    });

    xhr.send(JSON.stringify(body));
  });
}

export function bulkFetchGoodreadsCovers(
  body: {
    bookIds?: string[];
    collection?: MissingInfoCollection;
    onlyWithGoodreadsId?: boolean;
  },
  options?: { onProgress?: (progress: BulkFetchProgress) => void },
) {
  return streamBulkFetch("/admin/books/bulk-fetch-covers", body, options?.onProgress);
}

export function bulkFetchIsbn13FromGoodreads(
  body: {
    bookIds?: string[];
    collection?: MissingInfoCollection;
    onlyWithGoodreadsId?: boolean;
  },
  options?: { onProgress?: (progress: BulkFetchProgress) => void },
) {
  return streamBulkFetch("/admin/books/bulk-fetch-isbn", body, options?.onProgress);
}

export function bulkFetchMarketPriceFromAseeralkotb(
  body: {
    bookIds?: string[];
    collection?: MissingInfoCollection;
    onlyWithIsbn13?: boolean;
  },
  options?: { onProgress?: (progress: BulkFetchProgress) => void },
) {
  return streamBulkFetch(
    "/admin/books/bulk-fetch-market-price",
    body,
    options?.onProgress,
  );
}

/** Numeric Goodreads Book Id (CSV "Book Id") */
export function hasGoodreadsBookId(externalId: string | null | undefined): boolean {
  return !!externalId?.trim() && /^\d+$/.test(externalId.trim());
}

/** True when value is exactly 13 digits (ignoring spaces and hyphens). */
export function isValidIsbn13(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length === 13;
}

/** Empty or not a valid ISBN-13 — should be replaced from Goodreads. */
export function needsIsbn13(value: string | null | undefined): boolean {
  return !isValidIsbn13(value);
}
