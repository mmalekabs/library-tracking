import { apiFetch } from "./api";
import type { BindingType, BookFormat } from "@/types";

export interface GoodreadsCoverResult {
  coverUrl: string;
  goodreadsBookId: string;
  goodreadsUrl: string;
}

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
  existingBook: { id: string; title: string } | null;
}

export function fetchGoodreadsCover(bookId: string) {
  const id = bookId.trim();
  return apiFetch<GoodreadsCoverResult>(
    `/admin/goodreads/cover/${encodeURIComponent(id)}`,
  );
}

export function fetchGoodreadsBook(bookIdOrUrl: string) {
  const input = bookIdOrUrl.trim();
  const q = new URLSearchParams({ input });
  return apiFetch<GoodreadsBookData>(`/admin/goodreads/book?${q.toString()}`);
}
