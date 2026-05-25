import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as lookupService from "../../services/lookupService.js";

const router = Router();

router.get(
  "/authors",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const authors = await lookupService.listAuthors(search);
    sendSuccess(res, authors);
  }),
);

router.get(
  "/publishers",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const publishers = await lookupService.listPublishers(search);
    sendSuccess(res, publishers);
  }),
);

router.get(
  "/bookshelves",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const bookshelves = await lookupService.listBookshelves(search);
    sendSuccess(res, bookshelves);
  }),
);

export default router;
