import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import * as authorService from "../../services/authorService.js";
import * as bookService from "../../services/bookService.js";
import {
  entityBooksQuerySchema,
  entityListQuerySchema,
  entityNameSchema,
  mergeEntitiesSchema,
  type EntityBooksQuery,
  type EntityListQuery,
} from "../../validators/entity.js";
import { validateBody } from "../../validators/validate.js";
import { validateQuery } from "../../validators/query.js";
import { paramId } from "../../utils/params.js";

const router = Router();

router.get(
  "/",
  validateQuery(entityListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: EntityListQuery })
      .validatedQuery;
    const authors = await authorService.listAuthorsAdmin(query);
    sendSuccess(res, authors);
  }),
);

router.post(
  "/",
  validateBody(entityNameSchema),
  asyncHandler(async (req, res) => {
    const author = await authorService.createAuthor(req.body.name);
    sendSuccess(res, author, 201);
  }),
);

router.post(
  "/merge",
  validateBody(mergeEntitiesSchema),
  asyncHandler(async (req, res) => {
    const { targetId, sourceIds } = req.body;
    const result = await authorService.mergeAuthors(targetId, sourceIds);
    sendSuccess(res, result);
  }),
);

router.get(
  "/:id/books",
  validateQuery(entityBooksQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: EntityBooksQuery })
      .validatedQuery;
    const { books, pagination } = await bookService.listBooksByAuthor(
      paramId(req.params.id),
      query,
    );
    sendPaginated(res, books, pagination);
  }),
);

router.put(
  "/:id",
  validateBody(entityNameSchema),
  asyncHandler(async (req, res) => {
    const author = await authorService.updateAuthor(
      paramId(req.params.id),
      req.body.name,
    );
    sendSuccess(res, author);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await authorService.deleteAuthor(paramId(req.params.id));
    sendSuccess(res, { message: "Author deleted successfully" });
  }),
);

export default router;
