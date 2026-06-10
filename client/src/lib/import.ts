import { AUTH_TOKEN_KEY } from "./constants";

export interface ImportSettings {
  duplicateMode: "skip" | "overwrite" | "allow";
  defaultFormat: "PHYSICAL" | "DIGITAL" | "AUDIO";
  defaultToPurchase: boolean;
  defaultVisibility: boolean;
  columnMapping: Record<string, string>;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
  createdAuthors: string[];
  createdPublishers: string[];
}

export async function executeCsvImport(
  file: File,
  settings: ImportSettings,
): Promise<ImportReport> {
  const API_BASE =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  const form = new FormData();
  form.append("file", file);
  form.append("settings", JSON.stringify(settings));

  const response = await fetch(`${API_BASE}/admin/import/csv`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const json = await response.json();
  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? "Import failed");
  }
  return json.data;
}
