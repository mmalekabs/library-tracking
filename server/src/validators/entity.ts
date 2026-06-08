import { z } from "zod";

export const entityNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(500),
});

export const mergeEntitiesSchema = z
  .object({
    targetId: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .refine((data) => !data.sourceIds.includes(data.targetId), {
    message: "Target cannot appear in source list",
    path: ["sourceIds"],
  });

export type EntityNameInput = z.infer<typeof entityNameSchema>;
export type MergeEntitiesInput = z.infer<typeof mergeEntitiesSchema>;
