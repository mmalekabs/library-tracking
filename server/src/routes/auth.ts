import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { sendSuccess } from "../utils/response.js";
import { signToken } from "../utils/jwt.js";
import {
  changePasswordSchema,
  loginSchema,
} from "../validators/auth.js";
import { validateBody } from "../validators/validate.js";

const router = Router();

router.post(
  "/login",
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    const normalizedUsername = username.trim();

    const admin = await prisma.admin.findUnique({
      where: { username: normalizedUsername },
    });

    if (!admin) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);

    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }

    const token = signToken({ adminId: admin.id, username: admin.username });

    sendSuccess(res, {
      token,
      admin: { id: admin.id, username: admin.username },
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.adminId },
      select: { id: true, username: true, createdAt: true },
    });

    if (!admin) {
      throw new AppError(401, "UNAUTHORIZED", "Admin account not found");
    }

    sendSuccess(res, admin);
  }),
);

router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.adminId },
    });

    if (!admin) {
      throw new AppError(401, "UNAUTHORIZED", "Admin account not found");
    }

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!valid) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Current password is incorrect",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    sendSuccess(res, { message: "Password updated successfully" });
  }),
);

export default router;
