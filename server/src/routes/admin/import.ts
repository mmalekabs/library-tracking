import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as importService from "../../services/importService.js";
import { importSettingsSchema } from "../../validators/import.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const router = Router();

router.post(
  "/preview",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "VALIDATION_ERROR", "CSV file is required");
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const preview = importService.parseCsvPreview(csvContent);
    sendSuccess(res, preview);
  }),
);

router.post(
  "/csv",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "VALIDATION_ERROR", "CSV file is required");
    }

    const settingsRaw = req.body.settings;
    if (!settingsRaw) {
      throw new AppError(400, "VALIDATION_ERROR", "Import settings are required");
    }

    let settingsJson: unknown;
    try {
      settingsJson = JSON.parse(
        typeof settingsRaw === "string" ? settingsRaw : String(settingsRaw),
      );
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid settings JSON");
    }

    const settings = importSettingsSchema.parse(settingsJson);
    const csvContent = req.file.buffer.toString("utf-8");
    const report = await importService.importBooksFromCsv(csvContent, settings);
    sendSuccess(res, report);
  }),
);

export default router;
