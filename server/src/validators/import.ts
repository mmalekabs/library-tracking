import { z } from "zod";

export const importSettingsSchema = z.object({
  duplicateMode: z.enum(["skip", "overwrite", "allow"]).default("skip"),
  defaultFormat: z.enum(["PHYSICAL", "DIGITAL", "AUDIO"]).default("PHYSICAL"),
  defaultToPurchase: z.boolean().default(false),
  defaultVisibility: z.boolean().default(true),
  defaultStatus: z
    .enum(["TO_READ", "READING", "READ", "DID_NOT_FINISH", "ON_HOLD"])
    .default("TO_READ"),
  columnMapping: z.record(z.string(), z.string()),
});

export type ImportSettings = z.infer<typeof importSettingsSchema>;
