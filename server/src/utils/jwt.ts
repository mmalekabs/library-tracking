import jwt from "jsonwebtoken";

export interface JwtPayload {
  adminId: string;
  username: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === "string" || !decoded.adminId || !decoded.username) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }
  return {
    adminId: decoded.adminId as string,
    username: decoded.username as string,
  };
}
