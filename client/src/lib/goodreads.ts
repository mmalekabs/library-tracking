import { apiFetch } from "./api";

export interface GoodreadsCoverResult {
  coverUrl: string;
  goodreadsBookId: string;
  goodreadsUrl: string;
}

export function fetchGoodreadsCover(bookId: string) {
  const id = bookId.trim();
  return apiFetch<GoodreadsCoverResult>(
    `/admin/goodreads/cover/${encodeURIComponent(id)}`,
  );
}
