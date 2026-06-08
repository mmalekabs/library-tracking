import { z } from "zod";

const readingStatusEnum = z.enum([
  "READING",
  "READ",
  "DID_NOT_FINISH",
  "ON_HOLD",
]);

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional()
  .nullable();

export const createReadingEntrySchema = z.object({
  bookId: z.string().min(1),
  startedAt: optionalDate,
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
export type ReadingHistoryQuery = z.infer<typeof readingHistoryQuerySchema>;
export type ReadingStatsQuery = z.infer<typeof readingStatsQuerySchema>;
