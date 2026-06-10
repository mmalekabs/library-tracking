import type { Response } from "express";

export function streamNdjsonResponse<T, P extends object = Record<string, unknown>>(
  res: Response,
  run: (onProgress: (update: P) => void) => Promise<T>,
) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.flushHeaders?.();

  const write = (event: object) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  const onProgress = (update: P) => {
    write({ type: "progress", ...update });
  };

  void run(onProgress)
    .then((data) => {
      write({ type: "done", data });
      res.end();
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : "Request failed";
      write({ type: "error", message });
      res.end();
    });
}
