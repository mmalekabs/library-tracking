import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as aseeralkotbService from "../../services/aseeralkotbService.js";
import { paramId } from "../../utils/params.js";

const router = Router();

/** Look up list price on عصير الكتب and return market price with 10% discount applied */
router.get(
  "/price/:isbn13",
  asyncHandler(async (req, res) => {
    const isbn13 = paramId(req.params.isbn13);
    const titleFallback =
      typeof req.query.title === "string" ? req.query.title : undefined;
    const result = await aseeralkotbService.lookupMarketPriceByIsbn13(isbn13, {
      titleFallback,
    });
    sendSuccess(res, result);
  }),
);

export default router;
