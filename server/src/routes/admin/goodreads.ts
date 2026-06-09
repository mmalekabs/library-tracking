import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as goodreadsService from "../../services/goodreadsService.js";
import { paramId } from "../../utils/params.js";
import { validateQuery } from "../../validators/query.js";
import {
  goodreadsBookQuerySchema,
  type GoodreadsBookQuery,
} from "../../validators/goodreads.js";

const router = Router();

/** Resolve cover image URL from a Goodreads Book Id (CSV "Book Id" / externalId) */
router.get(
  "/cover/:bookId",
  asyncHandler(async (req, res) => {
    const bookId = paramId(req.params.bookId);
    const coverUrl = await goodreadsService.fetchCoverUrlByBookId(bookId);
    sendSuccess(res, {
      coverUrl,
      goodreadsBookId: bookId,
      goodreadsUrl: goodreadsService.goodreadsBookUrl(bookId),
    });
  }),
);

/** Fetch book metadata from Goodreads by Book Id or show-page URL */
router.get(
  "/book",
  validateQuery(goodreadsBookQuerySchema),
  asyncHandler(async (req, res) => {
    const { input } = (req as typeof req & { validatedQuery: GoodreadsBookQuery })
      .validatedQuery;
    sendSuccess(res, await goodreadsService.fetchBookDataByBookId(input));
  }),
);

export default router;
