import { z } from "zod";

export const goodreadsBookQuerySchema = z.object({
  input: z.string().min(1, "Goodreads ID or URL is required"),
});

export type GoodreadsBookQuery = z.infer<typeof goodreadsBookQuerySchema>;
