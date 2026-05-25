import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import * as bookService from "../../services/bookService.js";
import {
  bookListQuerySchema,
  bulkDeleteSchema,
  bulkVisibilitySchema,
  createBookSchema,
  updateBookSchema,
  visibilitySchema,
  type BookListQuery,
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
