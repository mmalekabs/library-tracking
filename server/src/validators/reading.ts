import { z } from "zod";

const bookFormatEnum = z.enum(["PHYSICAL", "DIGITAL", "AUDIO"]);
const bindingTypeEnum = z.enum([
  "PAPERBACK",
  "HARDCOVER",
  "MASS_MARKET_PAPERBACK",
  "KINDLE_EDITION",
  "UNKNOWN",
]);

const readingStatusEnum = z.enum([
  "READING",
  "READ",
  "DID_NOT_FINISH",
  "ON_HOLD",
]);

const activeReadingStatusEnum = z.enum(["READING", "ON_HOLD"]);

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional()
  .nullable();

export const createReadingEntrySchema = z
  .object({
    bookId: z.string().min(1),
    status: readingStatusEnum.optional(),
    startedAt: optionalDate,
    finishedAt: optionalDate,
    currentPage: z.coerce.number().int().min(0).optional().nullable(),
    rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    review: z.string().max(10000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const status = data.status ?? "READING";
    if (
      (status === "READ" || status === "DID_NOT_FINISH") &&
      !data.finishedAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "finishedAt is required when status is READ or DID_NOT_FINISH",
        path: ["finishedAt"],
      });
    }
  });

export const readableBooksQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createReadingOnlyBookSchema = z
  .object({
    title: z.string().min(1).max(500),
    externalId: z.string().optional().nullable(),
    authorName: z.string().max(200).optional().nullable(),
    additionalAuthorNames: z.array(z.string().max(200)).optional().default([]),
    publisherName: z.string().max(200).optional().nullable(),
    isbn: z.string().optional().nullable(),
    isbn13: z.string().optional().nullable(),
    edition: z.string().max(200).optional().nullable(),
    format: bookFormatEnum.optional(),
    binding: bindingTypeEnum.optional(),
    numberOfPages: z.coerce.number().int().min(1).optional().nullable(),
    yearPublished: z.coerce.number().int().optional().nullable(),
    originalPublicationYear: z.coerce.number().int().optional().nullable(),
    coverImageUrl: z.string().url().optional().nullable().or(z.literal("")),
    notes: z.string().max(5000).optional().nullable(),
    entry: z
      .object({
        status: readingStatusEnum.default("READING"),
        startedAt: optionalDate,
        finishedAt: optionalDate,
        currentPage: z.coerce.number().int().min(0).optional().nullable(),
        rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
        review: z.string().max(10000).optional().nullable(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const status = data.entry?.status ?? "READING";
    if (
      data.entry &&
      (status === "READ" || status === "DID_NOT_FINISH") &&
      !data.entry.finishedAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "finishedAt is required when status is READ or DID_NOT_FINISH",
        path: ["entry", "finishedAt"],
      });
    }
  });

export const updateReadingOnlyBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  externalId: z.string().optional().nullable(),
  authorName: z.string().max(200).optional().nullable(),
  additionalAuthorNames: z.array(z.string().max(200)).optional(),
  publisherName: z.string().max(200).optional().nullable(),
  isbn: z.string().optional().nullable(),
  isbn13: z.string().optional().nullable(),
  edition: z.string().max(200).optional().nullable(),
  format: bookFormatEnum.optional(),
  binding: bindingTypeEnum.optional(),
  numberOfPages: z.coerce.number().int().min(1).optional().nullable(),
  yearPublished: z.coerce.number().int().optional().nullable(),
  originalPublicationYear: z.coerce.number().int().optional().nullable(),
  coverImageUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .or(z.literal("")),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateReadingEntrySchema = z.object({
  status: readingStatusEnum.optional(),
  startedAt: optionalDate,
  finishedAt: optionalDate,
  currentPage: z.coerce.number().int().min(0).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  review: z.string().max(10000).optional().nullable(),
});

export const createReadingSessionSchema = z.object({
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  pagesRead: z.coerce.number().int().min(0).default(0),
  minutesRead: z.coerce.number().int().min(0).optional().nullable(),
  endPage: z.coerce.number().int().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const updateReadingSessionSchema = z.object({
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  pagesRead: z.coerce.number().int().min(0).optional(),
  minutesRead: z.coerce.number().int().min(0).optional().nullable(),
  endPage: z.coerce.number().int().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const readingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["READ", "DID_NOT_FINISH", "all"]).default("all"),
});

export const readingStatsQuerySchema = z.object({
  period: z.enum(["day", "week", "month", "year"]).default("month"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateReadingEntryInput = z.infer<typeof createReadingEntrySchema>;
export type UpdateReadingEntryInput = z.infer<typeof updateReadingEntrySchema>;
export type CreateReadingSessionInput = z.infer<typeof createReadingSessionSchema>;
export type UpdateReadingSessionInput = z.infer<typeof updateReadingSessionSchema>;
export type ReadingHistoryQuery = z.infer<typeof readingHistoryQuerySchema>;
export type ReadingStatsQuery = z.infer<typeof readingStatsQuerySchema>;
export type ReadableBooksQuery = z.infer<typeof readableBooksQuerySchema>;
export type CreateReadingOnlyBookInput = z.infer<
  typeof createReadingOnlyBookSchema
>;
export type UpdateReadingOnlyBookInput = z.infer<
  typeof updateReadingOnlyBookSchema
>;
export { activeReadingStatusEnum, readingStatusEnum };
