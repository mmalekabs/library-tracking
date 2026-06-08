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

export const entityBooksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  collection: z.enum(["library", "to_purchase"]).optional(),
});

export const entityListQuerySchema = z.object({
  search: z.string().optional(),
  collection: z.enum(["library", "to_purchase"]).default("library"),
  sortBy: z.enum(["name", "bookCount"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type EntityNameInput = z.infer<typeof entityNameSchema>;
export type MergeEntitiesInput = z.infer<typeof mergeEntitiesSchema>;
export type EntityBooksQuery = z.infer<typeof entityBooksQuerySchema>;
export type EntityListQuery = z.infer<typeof entityListQuerySchema>;
