import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../middleware/errorHandler.js";

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid query parameters", {
        fieldErrors: result.error.flatten().fieldErrors,
      });
    }

    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}
