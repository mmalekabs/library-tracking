export type BookFormat = "PHYSICAL" | "DIGITAL" | "AUDIO";

export type BindingType =
  | "PAPERBACK"
  | "HARDCOVER"
  | "MASS_MARKET_PAPERBACK"
  | "KINDLE_EDITION"
  | "UNKNOWN";

export interface Author {
  id: string;
  name: string;
}

export interface Publisher {
  id: string;
  name: string;
}

export interface Book {
  id: string;
  externalId: string | null;
  title: string;
  isbn: string | null;
  isbn13: string | null;
  purchasePrice: number | null;
  marketPrice: number | null;
  savings: number | null;
  currency: string;
  format: BookFormat;
  binding: BindingType;
  numberOfPages: number | null;
  yearPublished: number | null;
  originalPublicationYear: number | null;
  edition: string | null;
  isPubliclyVisible?: boolean;
  isGift?: boolean;
  toPurchase?: boolean;
  toSell?: boolean;
  createdAt?: string;
  updatedAt?: string;
  coverImageUrl: string | null;
  notes?: string | null;
  author: Author | null;
  additionalAuthors?: Author[];
  publisher: Publisher | null;
}
