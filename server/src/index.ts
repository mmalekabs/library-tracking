import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth.js";
import booksRouter from "./routes/books.js";
import toPurchaseRouter from "./routes/toPurchase.js";
import authorsRouter from "./routes/authors.js";
import publishersRouter from "./routes/publishers.js";
import adminRouter from "./routes/admin/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { publicApiRateLimiter } from "./middleware/rateLimiter.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET environment variable is required");
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
const isProd = process.env.NODE_ENV === "production";

app.use(
  helmet(
    isProd
      ? {
          // SPA + same-origin API: allow the site to load its own assets
          contentSecurityPolicy: false,
        }
      : undefined,
  ),
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

app.use("/api", publicApiRateLimiter);

app.use("/api/books", booksRouter);
app.use("/api/to-purchase", toPurchaseRouter);
app.use("/api/authors", authorsRouter);
app.use("/api/publishers", publishersRouter);
app.use(errorHandler);

if (isProd) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
