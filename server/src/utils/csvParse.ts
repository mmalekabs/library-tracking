import type { BindingType, BookFormat } from "@prisma/client";

const BINDING_MAP: Record<
  string,
  { format: BookFormat; binding: BindingType }
> = {
  paperback: { format: "PHYSICAL", binding: "PAPERBACK" },
  "mass market paperback": {
    format: "PHYSICAL",
    binding: "MASS_MARKET_PAPERBACK",
  },
  hardcover: { format: "PHYSICAL", binding: "HARDCOVER" },
  "kindle edition": { format: "DIGITAL", binding: "KINDLE_EDITION" },
  "unknown binding": { format: "PHYSICAL", binding: "UNKNOWN" },
};

export function mapBindingValue(
  raw: string | null | undefined,
  defaultFormat: BookFormat = "PHYSICAL",
): { format: BookFormat; binding: BindingType } {
  if (!raw?.trim()) {
    return { format: defaultFormat, binding: "PAPERBACK" };
  }
  const key = raw.trim().toLowerCase();
  return BINDING_MAP[key] ?? { format: defaultFormat, binding: "UNKNOWN" };
}

export function parseCsvDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  // YY-MM-DD (e.g. 24-05-26)
  const shortMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (shortMatch) {
    const year = 2000 + Number.parseInt(shortMatch[1], 10);
    const month = Number.parseInt(shortMatch[2], 10) - 1;
    const day = Number.parseInt(shortMatch[3], 10);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseIsbn13(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    return String(Math.round(value));
  }
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "nan") return null;
  const num = Number(str);
  if (!Number.isNaN(num) && str.includes("e")) {
    return String(Math.round(num));
  }
  return str;
}

export function parseIsbn(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  const str = String(value).trim();
  return str && str.toLowerCase() !== "nan" ? str : null;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "nan") return null;
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

export function parseOptionalInt(value: unknown): number | null {
  const num = parseOptionalNumber(value);
  return num === null ? null : Math.round(num);
}

export function splitCommaList(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "nan") return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const CSV_FIELD_KEYS = [
  "externalId",
  "title",
  "purchasePrice",
  "marketPrice",
  "author",
  "additionalAuthors",
  "isbn",
  "isbn13",
  "publisher",
  "binding",
  "numberOfPages",
  "yearPublished",
  "originalPublicationYear",
] as const;

export type CsvFieldKey = (typeof CSV_FIELD_KEYS)[number];

export const AUTO_COLUMN_MAP: Record<string, CsvFieldKey> = {
  "book id": "externalId",
  title: "title",
  "purchase price": "purchasePrice",
  "actual price": "marketPrice",
  author: "author",
  "additional authors": "additionalAuthors",
  isbn: "isbn",
  isbn13: "isbn13",
  publisher: "publisher",
  binding: "binding",
  "number of pages": "numberOfPages",
  "year published": "yearPublished",
  "original publication year": "originalPublicationYear",
};

export function detectColumnMapping(headers: string[]): Record<string, CsvFieldKey | ""> {
  const mapping: Record<string, CsvFieldKey | ""> = {};
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    mapping[header] = AUTO_COLUMN_MAP[key] ?? "";
  }
  return mapping;
}
