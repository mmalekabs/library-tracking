import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import * as bookService from "../services/bookService.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const publishers = await bookService.listPublicPublishers();
    sendSuccess(res, publishers);
  }),
);

export default router;
