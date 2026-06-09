import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import * as readingService from "../../services/readingService.js";
import {
  createReadingEntrySchema,
  createReadingOnlyBookSchema,
  createReadingSessionSchema,
  readableBooksQuerySchema,
  readingHistoryQuerySchema,
  readingStatsQuerySchema,
  updateReadingEntrySchema,
  updateReadingOnlyBookSchema,
  updateReadingSessionSchema,
  type ReadableBooksQuery,
  type ReadingHistoryQuery,
  type ReadingStatsQuery,
} from "../../validators/reading.js";
import { validateBody } from "../../validators/validate.js";
import { validateQuery } from "../../validators/query.js";
import { paramId } from "../../utils/params.js";

const router = Router();

router.get(
  "/books",
  validateQuery(readableBooksQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: ReadableBooksQuery })
      .validatedQuery;
    sendSuccess(res, await readingService.listReadableBooks(query));
  }),
);

router.post(
  "/books",
  validateBody(createReadingOnlyBookSchema),
  asyncHandler(async (req, res) => {
    const result = await readingService.createReadingOnlyBook(req.body);
    sendSuccess(res, result, 201);
  }),
);

router.get(
  "/books/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await readingService.getReadingOnlyBookById(paramId(req.params.id)),
    );
  }),
);

router.patch(
  "/books/:id",
  validateBody(updateReadingOnlyBookSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await readingService.updateReadingOnlyBook(paramId(req.params.id), req.body),
    );
  }),
);

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await readingService.getReadingSummary());
  }),
);

router.get(
  "/current",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await readingService.listCurrentlyReading());
  }),
);

router.get(
  "/history",
  validateQuery(readingHistoryQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: ReadingHistoryQuery })
      .validatedQuery;
    const { data, pagination } = await readingService.listHistory(query);
    sendPaginated(res, data, pagination);
  }),
);

router.get(
  "/stats",
  validateQuery(readingStatsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: ReadingStatsQuery })
      .validatedQuery;
    sendSuccess(res, await readingService.getReadingStats(query));
  }),
);

router.get(
  "/stats/books",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await readingService.getBookTimeStats());
  }),
);

router.get(
  "/entries/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await readingService.getEntryById(paramId(req.params.id)));
  }),
);

router.post(
  "/entries",
  validateBody(createReadingEntrySchema),
  asyncHandler(async (req, res) => {
    const entry = await readingService.createEntry(req.body);
    sendSuccess(res, entry, 201);
  }),
);

router.patch(
  "/entries/:id",
  validateBody(updateReadingEntrySchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await readingService.updateEntry(paramId(req.params.id), req.body),
    );
  }),
);

router.post(
  "/entries/:id/sessions",
  validateBody(createReadingSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await readingService.logSession(
      paramId(req.params.id),
      req.body,
    );
    sendSuccess(res, session, 201);
  }),
);

router.patch(
  "/sessions/:id",
  validateBody(updateReadingSessionSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await readingService.updateSession(paramId(req.params.id), req.body),
    );
  }),
);

router.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await readingService.deleteSession(paramId(req.params.id)));
  }),
);

export default router;
