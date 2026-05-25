import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as authorService from "../../services/authorService.js";
import { entityNameSchema } from "../../validators/entity.js";
import { validateBody } from "../../validators/validate.js";
import { paramId } from "../../utils/params.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const authors = await authorService.listAuthorsAdmin(search);
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
