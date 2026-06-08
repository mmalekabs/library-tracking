import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import * as bookService from "../../services/bookService.js";
import {
  bookListQuerySchema,
  bulkDeleteSchema,
  bulkFetchCoversSchema,
  bulkVisibilitySchema,
  createBookSchema,
  missingCoversQuerySchema,
  updateBookSchema,
  visibilitySchema,
  type BookListQuery,
  missingCoversSummaryQuerySchema,
  moveToLibrarySchema,
  type MissingCoversQuery,
  type MissingCoversSummaryQuery,
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
  "/missing-covers/summary",
  validateQuery(missingCoversSummaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { collection } = (
      req as typeof req & { validatedQuery: MissingCoversSummaryQuery }
    ).validatedQuery;
    const summary = await bookService.getMissingCoversSummary(collection);
    sendSuccess(res, summary);
  }),
);

router.get(
  "/missing-covers",
  validateQuery(missingCoversQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: MissingCoversQuery })
      .validatedQuery;
    const { books, pagination } = await bookService.listBooksMissingCovers(query);
    sendPaginated(res, books, pagination);
  }),
);

router.post(
  "/bulk-fetch-covers",
  validateBody(bulkFetchCoversSchema),
  asyncHandler(async (req, res) => {
    const report = await bookService.bulkFetchGoodreadsCovers(req.body);
    sendSuccess(res, report);
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
