import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as goodreadsService from "../../services/goodreadsService.js";
import { paramId } from "../../utils/params.js";

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
      goodreadsUrl: `https://www.goodreads.com/book/show/${bookId}`,
    });
  }),
);

export default router;
