import type { BindingType, BookFormat } from "@/types";
import type { GoodreadsBookData } from "./goodreads";

export interface ReadingBookDraft {
  title: string;
  externalId: string;
  authorName: string;
  additionalAuthorNames: string[];
  publisherName: string;
  isbn: string;
  isbn13: string;
  edition: string;
  format: BookFormat;
  binding: BindingType;
  numberOfPages: string;
  yearPublished: string;
  originalPublicationYear: string;
  coverImageUrl: string;
  notes: string;
}

export function emptyReadingBookDraft(): ReadingBookDraft {
  return {
    title: "",
    externalId: "",
    authorName: "",
    additionalAuthorNames: [],
    publisherName: "",
    isbn: "",
    isbn13: "",
    edition: "",
    format: "DIGITAL",
    binding: "PAPERBACK",
    numberOfPages: "",
    yearPublished: "",
    originalPublicationYear: "",
    coverImageUrl: "",
    notes: "",
  };
}

/** Map Goodreads metadata to a reading-book form draft (notes stay empty). */
export function goodreadsToReadingBookDraft(
  data: GoodreadsBookData,
): ReadingBookDraft {
  return {
    title: data.title,
    externalId: data.goodreadsBookId,
    authorName: data.authorName ?? "",
    additionalAuthorNames: data.additionalAuthorNames,
    publisherName: data.publisherName ?? "",
    isbn: data.isbn ?? "",
    isbn13: data.isbn13 ?? "",
    edition: "",
    format: data.format,
    binding: data.binding,
    numberOfPages: data.numberOfPages?.toString() ?? "",
    yearPublished: data.yearPublished?.toString() ?? "",
    originalPublicationYear: data.originalPublicationYear?.toString() ?? "",
    coverImageUrl: data.coverImageUrl ?? "",
    notes: "",
  };
}
