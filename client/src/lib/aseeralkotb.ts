import { apiFetch } from "./api";

export interface AseerAlkotbPriceResult {
  isbn13: string;
  listPrice: number;
  marketPrice: number;
  currency: string;
  bookId: string;
  bookUrl: string;
}

export function fetchAseeralkotbPrice(isbn13: string, title?: string) {
  const params = new URLSearchParams();
  if (title?.trim()) params.set("title", title.trim());
  const qs = params.toString();
  return apiFetch<AseerAlkotbPriceResult>(
    `/admin/aseeralkotb/price/${encodeURIComponent(isbn13.trim())}${qs ? `?${qs}` : ""}`,
  );
}
