import type { BookSortBy } from "@/lib/books";
import type { Book, BindingType, BookFormat, ReadingStatus } from "@/types";
import {
  BINDING_OPTIONS,
  CURRENCY_OPTIONS,
  FORMAT_OPTIONS,
  STATUS_OPTIONS,
} from "@/constants/book";

export type BookTableField =
  | "title"
  | "author"
  | "publisher"
  | "status"
  | "format"
  | "binding"
  | "purchasePrice"
  | "marketPrice"
  | "numberOfPages"
  | "yearPublished"
  | "isbn"
  | "isbn13"
  | "edition"
  | "currency"
  | "isPubliclyVisible"
  | "isGift";

export const BOOK_TABLE_COLUMNS = [
  { key: "title", label: "Title", minWidth: "12rem" },
  { key: "author", label: "Author", minWidth: "9rem" },
  { key: "publisher", label: "Publisher", minWidth: "8rem" },
  { key: "status", label: "Status", minWidth: "7rem" },
  { key: "format", label: "Format", minWidth: "6rem" },
  { key: "binding", label: "Binding", minWidth: "7rem" },
  { key: "purchasePrice", label: "Purchase", minWidth: "5rem" },
  { key: "marketPrice", label: "Market", minWidth: "5rem" },
  { key: "currency", label: "Currency", minWidth: "4rem" },
  { key: "numberOfPages", label: "Pages", minWidth: "4rem" },
  { key: "yearPublished", label: "Year", minWidth: "4rem" },
  { key: "isbn", label: "ISBN", minWidth: "7rem" },
  { key: "isPubliclyVisible", label: "Public", minWidth: "4rem" },
  { key: "isGift", label: "Gift?", minWidth: "4rem" },
] as const satisfies readonly {
  key: BookTableField;
  label: string;
  minWidth?: string;
}[];

export type BookTableColumnField = (typeof BOOK_TABLE_COLUMNS)[number]["key"];

/** Maps visible table column to API `sortBy`. */
export const BOOK_TABLE_SORT_BY: Record<BookTableColumnField, BookSortBy> = {
  title: "title",
  author: "author",
  publisher: "publisher",
  status: "status",
  format: "format",
  binding: "binding",
  purchasePrice: "purchasePrice",
  marketPrice: "marketPrice",
  currency: "currency",
  numberOfPages: "numberOfPages",
  yearPublished: "yearPublished",
  isbn: "isbn",
  isPubliclyVisible: "isPubliclyVisible",
  isGift: "isGift",
};

export const BOOK_TABLE_FIELD_LABELS: Record<BookTableField, string> =
  Object.fromEntries(
    BOOK_TABLE_COLUMNS.map((c) => [c.key, c.label]),
  ) as Record<BookTableField, string>;

export function getBookFieldDisplay(book: Book, field: BookTableField): string {
  switch (field) {
    case "title":
      return book.title;
    case "author":
      return book.author?.name ?? "";
    case "publisher":
      return book.publisher?.name ?? "";
    case "status":
      return STATUS_OPTIONS.find((o) => o.value === book.status)?.label ?? book.status;
    case "format":
      return FORMAT_OPTIONS.find((o) => o.value === book.format)?.label ?? book.format;
    case "binding":
      return BINDING_OPTIONS.find((o) => o.value === book.binding)?.label ?? book.binding;
    case "purchasePrice":
      return book.purchasePrice != null ? String(book.purchasePrice) : "";
    case "marketPrice":
      return book.marketPrice != null ? String(book.marketPrice) : "";
    case "numberOfPages":
      return book.numberOfPages != null ? String(book.numberOfPages) : "";
    case "yearPublished":
      return book.yearPublished != null ? String(book.yearPublished) : "";
    case "isbn":
      return book.isbn ?? "";
    case "isbn13":
      return book.isbn13 ?? "";
    case "edition":
      return book.edition ?? "";
    case "currency":
      return book.currency;
    case "isPubliclyVisible":
      return book.isPubliclyVisible ? "Yes" : "No";
    case "isGift":
      return book.isGift ? "Yes" : "No";
    default:
      return "";
  }
}

/** Raw value used while editing (enum values, numbers as strings, etc.) */
export function getBookFieldRaw(book: Book, field: BookTableField): string {
  switch (field) {
    case "status":
      return book.status;
    case "format":
      return book.format;
    case "binding":
      return book.binding;
    case "isPubliclyVisible":
      return book.isPubliclyVisible ? "true" : "false";
    case "isGift":
      return book.isGift ? "true" : "false";
    default:
      return getBookFieldDisplay(book, field);
  }
}

export function normalizeFieldValue(field: BookTableField, raw: string): string {
  const trimmed = raw.trim();
  if (field === "purchasePrice" || field === "marketPrice") {
    if (trimmed === "") return "";
    const n = Number(trimmed);
    return Number.isNaN(n) ? trimmed : String(n);
  }
  if (field === "numberOfPages" || field === "yearPublished") {
    if (trimmed === "") return "";
    const n = Number.parseInt(trimmed, 10);
    return Number.isNaN(n) ? trimmed : String(n);
  }
  if (field === "isPubliclyVisible" || field === "isGift") {
    return raw === "true" ? "true" : "false";
  }
  return trimmed;
}

export function valuesEqual(
  field: BookTableField,
  a: string,
  b: string,
): boolean {
  return normalizeFieldValue(field, a) === normalizeFieldValue(field, b);
}

export function buildBookFieldPayload(
  field: BookTableField,
  raw: string,
): Record<string, unknown> {
  const trimmed = raw.trim();

  switch (field) {
    case "title":
      return { title: trimmed };
    case "author":
      return { authorName: trimmed };
    case "publisher":
      return trimmed ? { publisherName: trimmed } : { publisherId: null };
    case "status":
      return { status: trimmed as ReadingStatus };
    case "format":
      return { format: trimmed as BookFormat };
    case "binding":
      return { binding: trimmed as BindingType };
    case "purchasePrice":
      return {
        purchasePrice: trimmed === "" ? null : Number(trimmed),
      };
    case "marketPrice":
      return {
        marketPrice: trimmed === "" ? null : Number(trimmed),
      };
    case "numberOfPages":
      return {
        numberOfPages: trimmed === "" ? null : Number.parseInt(trimmed, 10),
      };
    case "yearPublished":
      return {
        yearPublished: trimmed === "" ? null : Number.parseInt(trimmed, 10),
      };
    case "isbn":
      return { isbn: trimmed || null };
    case "isbn13":
      return { isbn13: trimmed || null };
    case "edition":
      return { edition: trimmed || null };
    case "currency":
      return { currency: trimmed || "SAR" };
    case "isPubliclyVisible":
      return { isPubliclyVisible: raw === "true" };
    case "isGift":
      return { isGift: raw === "true" };
    default:
      return {};
  }
}

export function fieldUsesSelect(field: BookTableField): boolean {
  return (
    field === "status" ||
    field === "format" ||
    field === "binding" ||
    field === "currency" ||
    field === "isPubliclyVisible" ||
    field === "isGift"
  );
}

export function getSelectOptions(field: BookTableField) {
  switch (field) {
    case "status":
      return STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    case "format":
      return FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    case "binding":
      return BINDING_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    case "currency":
      return CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }));
    case "isPubliclyVisible":
    case "isGift":
      return [
        { value: "true", label: "Yes" },
        { value: "false", label: "No" },
      ];
    default:
      return [];
  }
}

export function getInputType(field: BookTableField): string {
  if (field === "numberOfPages" || field === "yearPublished") return "number";
  if (field === "purchasePrice" || field === "marketPrice") return "number";
  return "text";
}
