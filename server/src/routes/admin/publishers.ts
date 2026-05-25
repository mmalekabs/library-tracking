import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import * as publisherService from "../../services/publisherService.js";
import { entityNameSchema } from "../../validators/entity.js";
import { validateBody } from "../../validators/validate.js";
import { paramId } from "../../utils/params.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const publishers = await publisherService.listPublishersAdmin(search);
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
