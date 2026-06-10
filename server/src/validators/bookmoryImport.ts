import { z } from "zod";

export const bookmoryImportSettingsSchema = z.object({
  duplicateMode: z
    .enum(["skip", "overwrite", "update_goodreads_id"])
    .default("skip"),
  importAs: z.enum(["library", "to_purchase", "reading_only"]).default("reading_only"),
  isPubliclyVisible: z.boolean().default(true),
  importReadingEntries: z.boolean().default(true),
  allowMissingAuthor: z.boolean().default(true),
});

export type BookmoryImportSettings = z.infer<typeof bookmoryImportSettingsSchema>;
