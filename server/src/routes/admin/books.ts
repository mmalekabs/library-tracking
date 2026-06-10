import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import { streamNdjsonResponse } from "../../utils/streamNdjson.js";
import * as bookService from "../../services/bookService.js";
import type { BulkFetchProgressUpdate } from "../../services/bookService.js";
import {
  bookListQuerySchema,
  bulkDeleteSchema,
  bulkFetchCoversSchema,
  bulkFetchIsbnSchema,
  bulkFetchMarketPriceSchema,
  bulkVisibilitySchema,
  createBookSchema,
  missingInfoQuerySchema,
  updateBookSchema,
  visibilitySchema,
  type BookListQuery,
  missingInfoSummaryQuerySchema,
  moveToLibrarySchema,
  type MissingInfoQuery,
  type MissingInfoSummaryQuery,
} from "../../validators/book.js";
import { validateBody } from "../../validators/validate.js";
import { validateQuery } from "../../validators/query.js";
import { paramId } from "../../utils/params.js";

const router = Router();

router.get(
  "/",
  validateQuery(bookListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: BookListQuery }).validatedQuery;
    const { books, pagination } = await bookService.listBooks(query, {
      includePricing: true,
      includeAdminFields: true,
    });
    sendPaginated(res, books, pagination);
  }),
);

router.post(
  "/",
  validateBody(createBookSchema),
  asyncHandler(async (req, res) => {
    const book = await bookService.createBook(req.body);
    sendSuccess(res, book, 201);
  }),
);

router.patch(
  "/bulk-visibility",
  validateBody(bulkVisibilitySchema),
  asyncHandler(async (req, res) => {
    const { ids, isPubliclyVisible } = req.body;
    const result = await bookService.bulkSetVisibility(ids, isPubliclyVisible);
    sendSuccess(res, result);
  }),
);

router.delete(
  "/bulk-delete",
  validateBody(bulkDeleteSchema),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await bookService.bulkDeleteBooks(ids);
    sendSuccess(res, result);
  }),
);

router.get(
  "/missing-info/summary",
  validateQuery(missingInfoSummaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { collection } = (
      req as typeof req & { validatedQuery: MissingInfoSummaryQuery }
    ).validatedQuery;
    const summary = await bookService.getMissingInfoSummary(collection);
    sendSuccess(res, summary);
  }),
);

router.get(
  "/missing-info",
  validateQuery(missingInfoQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: MissingInfoQuery })
      .validatedQuery;
    const { books, pagination } = await bookService.listBooksMissingInfo(query);
    sendPaginated(res, books, pagination);
  }),
);

router.post(
  "/bulk-fetch-covers",
  validateBody(bulkFetchCoversSchema),
  asyncHandler(async (req, res) => {
    streamNdjsonResponse<unknown, BulkFetchProgressUpdate>(res, (onProgress) =>
      bookService.bulkFetchGoodreadsCovers(req.body, onProgress),
    );
  }),
);

router.post(
  "/bulk-fetch-isbn",
  validateBody(bulkFetchIsbnSchema),
  asyncHandler(async (req, res) => {
    streamNdjsonResponse<unknown, BulkFetchProgressUpdate>(res, (onProgress) =>
      bookService.bulkFetchIsbn13FromGoodreads(req.body, onProgress),
    );
  }),
);

router.post(
  "/bulk-fetch-market-price",
  validateBody(bulkFetchMarketPriceSchema),
  asyncHandler(async (req, res) => {
    streamNdjsonResponse<unknown, BulkFetchProgressUpdate>(res, (onProgress) =>
      bookService.bulkFetchMarketPriceFromAseeralkotb(req.body, onProgress),
    );
  }),
);

router.post(
  "/:id/move-to-library",
  validateBody(moveToLibrarySchema),
  asyncHandler(async (req, res) => {
    const book = await bookService.moveBookToLibrary(
      paramId(req.params.id),
      req.body,
    );
    sendSuccess(res, book);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const book = await bookService.getBookById(paramId(req.params.id), {
      includePricing: true,
      includeAdminFields: true,
    });
    sendSuccess(res, book);
  }),
);

router.put(
  "/:id",
  validateBody(updateBookSchema),
  asyncHandler(async (req, res) => {
    const book = await bookService.updateBook(paramId(req.params.id), req.body);
    sendSuccess(res, book);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await bookService.deleteBook(paramId(req.params.id));
    sendSuccess(res, { message: "Book deleted successfully" });
  }),
);

router.patch(
  "/:id/visibility",
  validateBody(visibilitySchema),
  asyncHandler(async (req, res) => {
    const book = await bookService.setBookVisibility(
      paramId(req.params.id),
      req.body.isPubliclyVisible,
    );
    sendSuccess(res, book);
  }),
);

export default router;
