import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import * as bookService from "../services/bookService.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const authors = await bookService.listPublicAuthors();
    sendSuccess(res, authors);
  }),
);

export default router;
