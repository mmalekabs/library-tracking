import { Router } from "express";
import booksRouter from "./books.js";
import authorsRouter from "./authors.js";
import publishersRouter from "./publishers.js";
import lookupRouter from "./lookup.js";
import importRouter from "./import.js";
import statsRouter from "./stats.js";
import goodreadsRouter from "./goodreads.js";
import aseeralkotbRouter from "./aseeralkotb.js";
import bookmoryImportRouter from "./bookmoryImport.js";

const router = Router();

router.use("/books", booksRouter);
router.use("/authors", authorsRouter);
router.use("/publishers", publishersRouter);
router.use("/stats", statsRouter);
router.use("/import", importRouter);
router.use("/lookup", lookupRouter);
router.use("/goodreads", goodreadsRouter);
router.use("/aseeralkotb", aseeralkotbRouter);
router.use("/bookmory", bookmoryImportRouter);

export default router;
