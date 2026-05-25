import { z } from "zod";

const bookFormatEnum = z.enum(["PHYSICAL", "DIGITAL", "AUDIO"]);
const readingStatusEnum = z.enum([
  "TO_READ",
  "READING",
  "READ",
  "DID_NOT_FINISH",
  "ON_HOLD",
]);
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

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    const date = val instanceof Date ? val : new Date(val);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const bookListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  format: bookFormatEnum.optional(),
  status: readingStatusEnum.optional(),
  binding: bindingTypeEnum.optional(),
  authorId: z.string().optional(),
  publisherId: z.string().optional(),
  bookshelfId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minPages: z.coerce.number().int().optional(),
  maxPages: z.coerce.number().int().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  sortBy: z
    .enum([
      "title",
      "purchasePrice",
      "numberOfPages",
      "dateAdded",
      "yearPublished",
    ])
    .default("dateAdded"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  visibility: z.enum(["all", "public", "hidden"]).optional(),
  /** library = owned books only; to_purchase = wishlist only */
  collection: z.enum(["library", "to_purchase"]).default("library"),
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
  status: readingStatusEnum.default("TO_READ"),
  dateAdded: optionalDate,
  dateStartedReading: optionalDate,
  dateFinishedReading: optionalDate,
  isPubliclyVisible: z.boolean().default(true),
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
  bookshelfIds: z.array(z.string()).optional().default([]),
  bookshelfNames: z.array(z.string()).optional().default([]),
});

export const createBookSchema = bookFieldsSchema.refine(
  (data) => !!(data.authorId || data.authorName?.trim()),
  { message: "Primary author is required (authorId or authorName)", path: ["authorId"] },
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

export const missingCoversQuerySchema = z.object({
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

export const missingCoversSummaryQuerySchema = z.object({
  collection: z.enum(["all", "library", "to_purchase"]).default("all"),
});

export type MissingCoversQuery = z.infer<typeof missingCoversQuerySchema>;
export type MissingCoversSummaryQuery = z.infer<
  typeof missingCoversSummaryQuerySchema
>;
export type BulkFetchCoversInput = z.infer<typeof bulkFetchCoversSchema>;

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
