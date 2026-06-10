import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../middleware/errorHandler.js";
import * as bookmoryImportService from "../../services/bookmoryImportService.js";
import type { BookmoryProgressCallback } from "../../services/bookmoryImportService.js";
import { bookmoryImportSettingsSchema } from "../../validators/bookmoryImport.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv") ||
      name.endsWith(".json")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx, .csv, or .json Bookmory exports are allowed"));
    }
  },
});

const router = Router();

function streamBookmoryResponse<T>(
  res: Response,
  run: (onProgress: BookmoryProgressCallback) => Promise<T>,
) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.flushHeaders?.();

  const write = (event: object) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  const onProgress: BookmoryProgressCallback = (update) => {
    write({ type: "progress", ...update });
  };

  void run(onProgress)
    .then((data) => {
      write({ type: "done", data });
      res.end();
    })
    .catch((err) => {
      const message =
        err instanceof Error ? err.message : "Bookmory import request failed";
      write({ type: "error", message });
      res.end();
    });
}

router.post(
  "/preview",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "VALIDATION_ERROR", "Backup file is required");
    }
    streamBookmoryResponse(res, (onProgress) =>
      bookmoryImportService.previewBookmoryImport(
        req.file!.buffer,
        req.file!.originalname,
        onProgress,
      ),
    );
  }),
);

router.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "VALIDATION_ERROR", "Backup file is required");
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

    const settings = bookmoryImportSettingsSchema.parse(settingsJson);
    streamBookmoryResponse(res, (onProgress) =>
      bookmoryImportService.importBookmoryFile(
        req.file!.buffer,
        req.file!.originalname,
        settings,
        onProgress,
      ),
    );
  }),
);

export default router;
