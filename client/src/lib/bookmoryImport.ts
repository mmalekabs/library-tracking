import { AUTH_TOKEN_KEY } from "./constants";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";

export interface BookmoryImportSettings {
  duplicateMode: "skip" | "overwrite" | "update_goodreads_id";
  importAs: "library" | "to_purchase";
  isPubliclyVisible: boolean;
  allowMissingAuthor: boolean;
}

export interface BookmoryPreviewBook {
  sourceRow: number;
  title: string;
  author: string | null;
  numberOfPages: number | null;
  rating: number | null;
  pagesRead: number | null;
  totalReadMinutes: number | null;
  totalReadTimeRaw: string | null;
  tags: string[];
  collections: string[];
  toPurchase: boolean;
  inLibrary: boolean;
  externalId: string | null;
  warnings: string[];
  duplicate: { id: string; title: string; matchBy: string } | null;
}

export interface BookmoryImportPreview {
  fileName: string;
  format: "xlsx" | "csv" | "json";
  headers: string[];
  columnMapping: Record<string, string>;
  headerRowIndex: number;
  parseWarnings: string[];
  books: BookmoryPreviewBook[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    withReadingData: number;
    withReadTime: number;
    withGoodreadsId: number;
    wishlist: number;
    inLibrary: number;
  };
}

export interface BookmoryImportReport {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface BookmoryUploadProgress {
  phase: "uploading" | "parsing" | "checking" | "importing";
  percent: number;
  current: number;
  total: number;
  currentTitle: string | null;
}

interface UploadOptions {
  settings?: BookmoryImportSettings;
  onProgress?: (progress: BookmoryUploadProgress) => void;
}

const UPLOAD_SHARE = 8;

function mapServerPercent(serverPercent: number): number {
  return Math.min(100, Math.round(UPLOAD_SHARE + serverPercent * 0.92));
}

type StreamEvent =
  | {
      type: "progress";
      phase: "parsing" | "checking" | "importing";
      current: number;
      total: number;
      currentTitle: string | null;
      percent: number;
    }
  | { type: "done"; data: unknown }
  | { type: "error"; message: string };

async function uploadBookmoryFile<T>(
  path: string,
  file: File,
  options?: UploadOptions,
): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const form = new FormData();
  form.append("file", file);
  if (options?.settings) {
    form.append("settings", JSON.stringify(options.settings));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/admin/bookmory/${path}`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    let responseOffset = 0;
    let lineBuffer = "";
    let settled = false;

    const emit = (progress: BookmoryUploadProgress) => {
      options?.onProgress?.(progress);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const handleEvent = (event: StreamEvent) => {
      if (event.type === "progress") {
        emit({
          phase: event.phase,
          percent: mapServerPercent(event.percent),
          current: event.current,
          total: event.total,
          currentTitle: event.currentTitle,
        });
        return;
      }

      if (event.type === "done") {
        finish(() => resolve(event.data as T));
        return;
      }

      if (event.type === "error") {
        finish(() => reject(new Error(event.message)));
      }
    };

    const processStreamChunk = () => {
      const chunk = xhr.responseText.slice(responseOffset);
      if (!chunk) return;
      responseOffset = xhr.responseText.length;
      lineBuffer += chunk;

      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          handleEvent(JSON.parse(trimmed) as StreamEvent);
        } catch {
          finish(() => reject(new Error("Bookmory import request failed")));
          return;
        }
        if (settled) return;
      }
    };

    emit({
      phase: "uploading",
      percent: 0,
      current: 0,
      total: file.size,
      currentTitle: file.name,
    });

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      emit({
        phase: "uploading",
        percent: Math.round((event.loaded / event.total) * UPLOAD_SHARE),
        current: event.loaded,
        total: event.total,
        currentTitle: file.name,
      });
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) {
        processStreamChunk();
      }
    };

    xhr.addEventListener("load", () => {
      processStreamChunk();
      if (lineBuffer.trim()) {
        try {
          handleEvent(JSON.parse(lineBuffer.trim()) as StreamEvent);
        } catch {
          if (!settled) {
            finish(() => reject(new Error("Bookmory import request failed")));
          }
        }
      }

      if (!settled) {
        if (xhr.status < 200 || xhr.status >= 300) {
          finish(() =>
            reject(new Error("Bookmory import request failed")),
          );
        } else {
          finish(() =>
            reject(new Error("Bookmory import ended without a result")),
          );
        }
      }
    });

    xhr.addEventListener("error", () => {
      finish(() => reject(new Error("Bookmory import request failed")));
    });

    xhr.addEventListener("abort", () => {
      finish(() => reject(new Error("Bookmory import request was cancelled")));
    });

    xhr.send(form);
  });
}

export function previewBookmoryImport(
  file: File,
  options?: Pick<UploadOptions, "onProgress">,
) {
  return uploadBookmoryFile<BookmoryImportPreview>("preview", file, options);
}

export function executeBookmoryImport(
  file: File,
  settings: BookmoryImportSettings,
  options?: Pick<UploadOptions, "onProgress">,
) {
  return uploadBookmoryFile<BookmoryImportReport>("import", file, {
    settings,
    ...options,
  });
}
