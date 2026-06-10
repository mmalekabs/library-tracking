import { z } from "zod";

const bookFormatEnum = z.enum(["PHYSICAL", "DIGITAL", "AUDIO"]);
const bindingTypeEnum = z.enum([
  "PAPERBACK",
  "HARDCOVER",
  "MASS_MARKET_PAPERBACK",
  "KINDLE_EDITION",
  "UNKNOWN",
]);

const optionalDecimal = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    const num = typeof val === "number" ? val : Number(val);
    return Number.isNaN(num) ? null : num;
  });

const optionalInt = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    const num = typeof val === "number" ? val : Number.parseInt(String(val), 10);
    return Number.isNaN(num) ? null : num;
  });

export const bookListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  format: bookFormatEnum.optional(),
  binding: bindingTypeEnum.optional(),
  authorId: z.string().optional(),
  publisherId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minPages: z.coerce.number().int().optional(),
  maxPages: z.coerce.number().int().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  sortBy: z
    .enum([
      "title",
      "author",
      "publisher",
      "format",
      "binding",
      "purchasePrice",
      "marketPrice",
      "currency",
      "numberOfPages",
      "yearPublished",
      "isbn",
      "externalId",
      "isPubliclyVisible",
      "isGift",
      "createdAt",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  visibility: z.enum(["all", "public", "hidden"]).optional(),
  /** library = owned books only; to_purchase = wishlist only */
  collection: z
    .enum(["library", "to_purchase", "all"])
    .default("library"),
  /** Filter by record creation date (YYYY-MM-DD), inclusive */
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
});

export type BookListQuery = z.infer<typeof bookListQuerySchema>;

const bookFieldsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  externalId: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  isbn13: z.string().optional().nullable(),
  purchasePrice: optionalDecimal,
  marketPrice: optionalDecimal,
  currency: z.string().default("SAR"),
  format: bookFormatEnum.default("PHYSICAL"),
  binding: bindingTypeEnum.default("PAPERBACK"),
  numberOfPages: optionalInt,
  yearPublished: optionalInt,
  originalPublicationYear: optionalInt,
  edition: z.string().optional().nullable(),
  isPubliclyVisible: z.boolean().default(true),
  isGift: z.boolean().default(false),
  toPurchase: z.boolean().default(false),
  coverImageUrl: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
  notes: z.string().optional().nullable(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  additionalAuthorIds: z.array(z.string()).optional().default([]),
  additionalAuthorNames: z.array(z.string()).optional().default([]),
  publisherId: z.string().optional().nullable(),
  publisherName: z.string().optional().nullable(),
});

export const createBookSchema = bookFieldsSchema.refine(
  (data) =>
    data.toPurchase || !!(data.authorId || data.authorName?.trim()),
  {
    message: "Primary author is required for library books (authorId or authorName)",
    path: ["authorId"],
  },
);

export const moveToLibrarySchema = z
  .object({
    numberOfPages: z.coerce.number().int().min(1),
    authorId: z.string().optional(),
    authorName: z.string().optional(),
    publisherId: z.string().optional().nullable(),
    publisherName: z.string().optional().nullable(),
    marketPrice: z.coerce.number().min(0),
    purchasePrice: optionalDecimal,
  })
  .refine((data) => !!(data.authorId || data.authorName?.trim()), {
    message: "Author is required (authorId or authorName)",
    path: ["authorId"],
  })
  .refine(
    (data) => !!(data.publisherId || data.publisherName?.trim()),
    {
      message: "Publisher is required (publisherId or publisherName)",
      path: ["publisherId"],
    },
  );

export const updateBookSchema = bookFieldsSchema
  .partial()
  .extend({
    authorId: z.string().optional(),
    authorName: z.string().optional(),
  })
  .refine(
    (data) =>
      data.authorId !== undefined ||
      data.authorName !== undefined ||
      Object.keys(data).length > 0,
    { message: "At least one field is required to update" },
  );

export const visibilitySchema = z.object({
  isPubliclyVisible: z.boolean(),
});

export const bulkVisibilitySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  isPubliclyVisible: z.boolean(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const missingInfoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
  /** When true, only books with a numeric Goodreads Book Id */
  withGoodreadsIdOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? false : v === "true")),
});

export const bulkFetchCoversSchema = z.object({
  bookIds: z.array(z.string().min(1)).optional(),
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
  onlyWithGoodreadsId: z.boolean().default(true),
});

export const bulkFetchIsbnSchema = z.object({
  bookIds: z.array(z.string().min(1)).optional(),
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
  onlyWithGoodreadsId: z.boolean().default(true),
});

export const bulkFetchMarketPriceSchema = z.object({
  bookIds: z.array(z.string().min(1)).optional(),
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
  onlyWithIsbn13: z.boolean().default(true),
});

export const missingInfoSummaryQuerySchema = z.object({
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
});

export type MissingInfoQuery = z.infer<typeof missingInfoQuerySchema>;
export type MissingInfoSummaryQuery = z.infer<
  typeof missingInfoSummaryQuerySchema
>;
export type BulkFetchCoversInput = z.infer<typeof bulkFetchCoversSchema>;
export type BulkFetchIsbnInput = z.infer<typeof bulkFetchIsbnSchema>;
export type BulkFetchMarketPriceInput = z.infer<typeof bulkFetchMarketPriceSchema>;

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type MoveToLibraryInput = z.infer<typeof moveToLibrarySchema>;
