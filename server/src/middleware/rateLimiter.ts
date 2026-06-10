import type { Request } from "express";
import rateLimit from "express-rate-limit";

/** Public catalog routes only — admin/auth are mounted outside this limiter. */
export const publicApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const path = req.path;
    return path.startsWith("/auth") || path.startsWith("/admin");
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
    },
  },
});
