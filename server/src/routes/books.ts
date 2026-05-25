import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../utils/response.js";
import * as bookService from "../services/bookService.js";
import { bookListQuerySchema, type BookListQuery } from "../validators/book.js";
import { validateQuery } from "../validators/query.js";
import { paramId } from "../utils/params.js";

const router = Router();

router.get(
  "/",
  validateQuery(bookListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: BookListQuery }).validatedQuery;
    const { books, pagination } = await bookService.listBooks(query, {
      publicOnly: true,
      includePricing: false,
    });
    sendPaginated(res, books, pagination);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const book = await bookService.getBookById(paramId(req.params.id), {
      publicOnly: true,
      includePricing: false,
    });
    sendSuccess(res, book);
  }),
);

export default router;
