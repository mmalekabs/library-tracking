import { z } from "zod";

export const entityNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(500),
});

export type EntityNameInput = z.infer<typeof entityNameSchema>;
