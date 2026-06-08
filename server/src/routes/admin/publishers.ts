import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../../utils/response.js";
import * as bookService from "../../services/bookService.js";
import * as publisherService from "../../services/publisherService.js";
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
    const publishers = await publisherService.listPublishersAdmin(query);
    sendSuccess(res, publishers);
  }),
);

router.post(
  "/",
  validateBody(entityNameSchema),
  asyncHandler(async (req, res) => {
    const publisher = await publisherService.createPublisher(req.body.name);
    sendSuccess(res, publisher, 201);
  }),
);

router.post(
  "/merge",
  validateBody(mergeEntitiesSchema),
  asyncHandler(async (req, res) => {
    const { targetId, sourceIds } = req.body;
    const result = await publisherService.mergePublishers(targetId, sourceIds);
    sendSuccess(res, result);
  }),
);

router.get(
  "/:id/books",
  validateQuery(entityBooksQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as typeof req & { validatedQuery: EntityBooksQuery })
      .validatedQuery;
    const { books, pagination } = await bookService.listBooksByPublisher(
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
    const publisher = await publisherService.updatePublisher(
      paramId(req.params.id),
      req.body.name,
    );
    sendSuccess(res, publisher);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await publisherService.deletePublisher(paramId(req.params.id));
    sendSuccess(res, { message: "Publisher deleted successfully" });
  }),
);

export default router;
