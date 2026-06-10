import type { BookFormat, BindingType } from "@/types";

export const FORMAT_OPTIONS: { value: BookFormat; label: string }[] = [
  { value: "PHYSICAL", label: "Physical" },
  { value: "DIGITAL", label: "Digital" },
  { value: "AUDIO", label: "Audio" },
];

export const BINDING_OPTIONS: { value: BindingType; label: string }[] = [
  { value: "PAPERBACK", label: "Paperback" },
  { value: "HARDCOVER", label: "Hardcover" },
  { value: "MASS_MARKET_PAPERBACK", label: "Mass Market Paperback" },
  { value: "KINDLE_EDITION", label: "Kindle Edition" },
  { value: "UNKNOWN", label: "Unknown" },
];

export const CURRENCY_OPTIONS = ["SAR", "USD", "EUR", "GBP"];

export const CSV_FIELD_OPTIONS = [
  { value: "", label: "— Skip —" },
  { value: "externalId", label: "Book Id" },
  { value: "title", label: "Title" },
  { value: "purchasePrice", label: "Purchase Price" },
  { value: "marketPrice", label: "Actual / Market Price" },
  { value: "author", label: "Author" },
  { value: "additionalAuthors", label: "Additional Authors" },
  { value: "isbn", label: "ISBN" },
  { value: "isbn13", label: "ISBN13" },
  { value: "publisher", label: "Publisher" },
  { value: "binding", label: "Binding" },
  { value: "numberOfPages", label: "Number of Pages" },
  { value: "yearPublished", label: "Year Published" },
  { value: "originalPublicationYear", label: "Original Publication Year" },
];
