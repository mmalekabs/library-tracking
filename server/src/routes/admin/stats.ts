import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as statsService from "../../services/statsService.js";

const router = Router();

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getOverview());
  }),
);

router.get(
  "/reading",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getReading());
  }),
);

router.get(
  "/spending",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getSpending());
  }),
);

router.get(
  "/authors",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getAuthors());
  }),
);

router.get(
  "/publishers",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getPublishers());
  }),
);

router.get(
  "/formats",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getFormats());
  }),
);

router.get(
  "/timeline",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getTimeline());
  }),
);

router.get(
  "/bookshelves",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getBookshelves());
  }),
);

router.get(
  "/pages",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getPagesAndBinding());
  }),
);

router.get(
  "/lists",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await statsService.getLists());
  }),
);

export default router;
