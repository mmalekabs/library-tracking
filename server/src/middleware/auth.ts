import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.js";
import { verifyToken } from "../utils/jwt.js";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    req.admin = verifyToken(header.slice(7));
    next();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
